# The Unvanquished: Forum moderation preview checklist

This branch is for **testing**, not a production rollout. Member posting stays disabled until anti-spam and moderation are verified.

## Netlify setup
1. Under Project configuration > Environment variables, add `FORUM_ADMIN_TOKEN`.
2. Mark it **Contains secret values** and use a unique, random value of at least 32 characters. Never paste it into source code, issues, or chat.
3. Scope access to **Deploy Previews** via a context-specific value. Leave Production unset until moderation has been tested and approved.
4. Trigger a new deploy preview after saving the variable. Secret edits do not change an already built deployment.

## Verify the preview
- Open `https://deploy-preview-3--unvanquished.netlify.app/forum-admin.html`.
- Confirm a wrong key **does not** unlock moderation controls.
- Enter the correct private key. It should authenticate and show the discussion list (empty while there are no test posts).
- Verify delete-topic and delete-reply using *test records only* after posting is configured in the preview.
- Confirm the public /forums board remains read-only until Turnstile and the environment flag are set.

## Remaining before production
- Configure Cloudflare Turnstile with the appropriate preview and production hostnames.
- Ensure `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `FORUM_POSTING_ENABLED` are correctly scoped.
- Verify rate limiting, storage isolation, posting, replies, deletion, and how backups/restores work.
- Keep the production forum read-only until all checks pass.
