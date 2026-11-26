# Customer LINE setup (two branches)

## Database and server

Run `migrations/20261126_line_customers.sql` in Neon. It includes the tracking session/link tables, so it can also be used when the earlier tracking migration has not been run.

Set `LINE_CONFIG_ENCRYPTION_KEY` in the Vercel Production environment before enabling the feature. Generate 32 random bytes locally, encoded as base64, for example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep this server-only key stable and backed up securely. Changing it makes existing encrypted credentials and pending deliveries unreadable. Never commit the value. `TRACKING_PUBLIC_ORIGIN` optionally overrides the HTTPS public origin; the default is https://rizenic-backend.vercel.app. Redeploy after changing environment variables.

## Each branch OA

Create/enable the Messaging API channel for each official account. Obtain its Channel access token and Channel secret. A manually configured long-lived channel access token is supported. A group ID is not needed for individual customer delivery.

Open Admin > ตั้งค่า LINE ลูกค้า. Enter credentials separately for Navamin and Rangsit, enable follower capture, and save. Check that the verified OA name belongs to the intended branch. Saved secrets are encrypted and never returned to the browser.

Copy the corresponding Webhook URL into LINE Developers and enable Use webhook:

- Navamin: https://rizenic-backend.vercel.app/api/line/webhook/navamin
- Rangsit: https://rizenic-backend.vercel.app/api/line/webhook/rangsit

Verify the webhook after deployment. Enable customer sending only after checking the OA. Saving settings does not send a message. Preview deployments cannot save credentials or send customer cards. Existing group report credentials and routing remain separate.

## Staff workflow

Save the job first. At the top of the form, generate and copy a 24-hour link, or select an unmatched customer profile from the job's branch. Confirm the saved plate, customer name, OA profile and branch before pairing/sending. A visit can cover multiple jobs; pairing applies to that visit. Expired links show an expiry message. Staff can reauthenticate inline without leaving unsaved form data.

Only new follow/unfollow events update contacts; existing friends are not imported. Follow includes adding or unblocking the account. Repeated events are deduplicated. Ordinary chat events are ignored without database/profile requests. State-changing webhook events require the original-body signature and matching OA identity.

Push payloads are encrypted in a durable outbox. Uncertain network results retry the same LINE retry key to reduce duplicate sends. Accepted means LINE accepted the API request; it does not confirm that the customer read or received the message. A card is a snapshot at send time; its tracking link shows current status.

## Validation scope

Automated tests use mocked database and LINE services; browser checks use fixture data. No real customer messages have been sent. The migration and real OA credentials still need to be configured and verified in the deployment environment.

Official references: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/ and https://developers.line.biz/en/docs/messaging-api/retrying-api-request/
