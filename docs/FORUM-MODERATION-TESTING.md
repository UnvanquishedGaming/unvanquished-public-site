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

## Turnstile preview posting test (October 29)
The site owner added the following Netlify variables with **Deploy Previews-only** values:
- `FORUM_ADMIN_TOKEN` (private, used by moderation)
- `TURNSTILE_SITE_KEY` (public site key)
- `TURNSTILE_SECRET_KEY` (private; previous exposed key rotated)
- `FORUM_POSTING_ENABLED=true`

The production context remains unset. Redeploy this pull request after variables change so the Netlify Functions inherit the updated environment.

On `https://deploy-preview-3--unvanquished.netlify.app/forums`, verify:
1. **New Discussion** becomes enabled and Cloudflare Turnstile loads.
2. Create a harmless test topic under **General Discussion**, then refresh to confirm it persists within this deploy.
3. Create a reply and verify both are visible.
4. Try the **EVE Guides** category and verify filtering.
5. Log into `/forum-admin.html`, delete the test reply, then delete the test topic.
6. Confirm the public production site still has posting disabled.

Never paste Turnstile secrets or moderator credentials into GitHub, code, screenshots, or support requests. Preview records are per-deploy; they may not survive a new preview deployment.
