package com.rizenic.backend.operations;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Serves attachment metadata recorded in the database from the configured storage directory. */
@RestController
@RequestMapping({"/api/v1", "/api"})
public class AttachmentController {
    private final JdbcClient db;

    public AttachmentController(JdbcClient db) {
        this.db = db;
    }

    @GetMapping("/attachments/{storageKey:.+}")
    public ResponseEntity<byte[]> get(@PathVariable String storageKey) {
        var metadata = db.sql("""
                select storage_key, media_type
                from rizenic_new.attachments
                where storage_key=:key
                """).param("key", storageKey).query((row, n) -> Map.of(
                "storage_key", row.getString("storage_key"),
                "media_type", row.getString("media_type")
        )).optional().orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "ไม่พบไฟล์แนบ"));

        Path root = Paths.get(System.getenv().getOrDefault("ATTACHMENT_STORAGE_PATH", "./data/attachments"))
                .toAbsolutePath().normalize();
        Path file = root.resolve(storageKey).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(NOT_FOUND, "ไม่พบไฟล์แนบ");
        }
        try {
            MediaType mediaType = MediaType.parseMediaType(String.valueOf(metadata.get("media_type")));
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + storageKey + "\"")
                    .body(Files.readAllBytes(file));
        } catch (java.io.IOException | IllegalArgumentException e) {
            throw new ResponseStatusException(NOT_FOUND, "ไม่สามารถอ่านไฟล์แนบ", e);
        }
    }
}
