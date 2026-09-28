# RIZENIC Production Notes

This build keeps the existing database schema and data unchanged. Performance and safety changes are implemented in Node/API/frontend code only.

## Before deployment

1. Keep the existing `DATABASE_URL`.
2. Set `APP_SESSION_SECRET` to a long random secret so sessions remain stable across instances/restarts.
3. Put the four LINE values in hosting environment variables. Because older source contained LINE credentials, rotate those credentials in LINE once and store only the rotated values in hosting secrets. The application still starts when they are missing; only LINE notification returns a configuration error instead of crashing the application.
4. Existing Dynamic Sync remains backward compatible. After external clients are updated, set `SYNC_REQUIRE_API_KEY=1` and configure `SYNC_API_KEY`.
5. `COOKIE_SECURE=auto` is recommended. HTTPS requests get Secure cookies; HTTP/LAN deployments do not accidentally lock users out.
6. `PG_SSL_VERIFY=0` preserves compatibility with providers using untrusted/self-signed chains. Set it to `1` when the provider certificate is trusted and verified.

## After deployment smoke check

- Open `/api/health` and verify `{ "ok": true }`.
- Login once. Existing browser sessions from the older build may require one login because the server now also issues a signed HttpOnly session cookie.
- Open Dashboard, Jobs, Parts, Finance and Admin.
- Verify LINE notification if LINE is used.
- Verify Dynamic Sync if an external integration uses it.

No SQL migration is required for this build.
