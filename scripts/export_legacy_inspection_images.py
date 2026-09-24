#!/usr/bin/env python3
"""Safely materialize legacy inspection diagrams into ATTACHMENT_STORAGE_PATH.

Reads the legacy image rows and updates only the attachment checksum after a
verified export; files are written atomically and never replaced when the
existing bytes already match. Requires psycopg or
psycopg2 and the normal PostgreSQL environment variables/DATABASE_URL.
"""
from __future__ import annotations

import base64
import hashlib
import os
import tempfile
from pathlib import Path

try:
    import psycopg  # psycopg3
except ImportError:  # pragma: no cover
    import psycopg2 as psycopg  # type: ignore


def connect():
    url = os.environ.get("DATABASE_URL")
    return psycopg.connect(url) if url else psycopg.connect("")


def main() -> None:
    root = Path(os.environ.get("ATTACHMENT_STORAGE_PATH", "./data/attachments"))
    root.mkdir(parents=True, exist_ok=True)
    query = """
      SELECT a.storage_key, a.sha256, i.car_diagram_image
      FROM rizenic_new.attachments a
      JOIN rizenic_old.inspection_reports i
        ON a.storage_key = 'legacy-inspection-' || i.id || '-diagram'
      WHERE i.car_diagram_image IS NOT NULL AND btrim(i.car_diagram_image) <> ''
    """
    written = skipped = 0
    with connect() as conn, conn.cursor() as cur:
        cur.execute(query)
        for key, expected_hash, encoded in cur.fetchall():
            raw_source = str(encoded)
            raw_source_digest = hashlib.sha256(raw_source.encode("utf-8")).hexdigest()
            raw = raw_source
            if raw.startswith("data:"):
                raw = raw.split(",", 1)[1]
            data = base64.b64decode(raw, validate=False)
            digest = hashlib.sha256(data).hexdigest()
            # V002 stored the digest of the original Base64 text. New uploads
            # store the digest of binary bytes, so accept either during repair.
            if expected_hash and expected_hash not in (digest, raw_source_digest):
                raise RuntimeError(f"sha256 mismatch for {key}: {digest} != {expected_hash}")
            target = root / key
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
                skipped += 1
            else:
                fd, temporary = tempfile.mkstemp(prefix=f".{key}.", dir=root)
                try:
                    with os.fdopen(fd, "wb") as out:
                        out.write(data)
                        out.flush()
                        os.fsync(out.fileno())
                    os.replace(temporary, target)
                finally:
                    if os.path.exists(temporary):
                        os.unlink(temporary)
                written += 1
            cur.execute(
                "UPDATE rizenic_new.attachments SET sha256=%s, byte_size=%s "
                "WHERE storage_key=%s AND sha256<>%s",
                (digest, len(data), key, digest),
            )
    print(f"legacy inspection images: written={written} skipped={skipped} path={root}")


if __name__ == "__main__":
    main()
