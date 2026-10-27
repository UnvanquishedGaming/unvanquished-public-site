# THE UNVANQUISHED — combined website update (stage for review)

This package is based on the actual GitHub ZIP supplied by the site owner on October 26, 2026.
It preserves all source HTML/CSS/assets/Pages CMS content, and adds three prepared features:

1. **Killboard**: new killboard-feed.js; current corporation ID 98827058; most recent kill/loss on Home and 10 entries on Killboard. Public zKillboard API + public EVE name lookup; cached per visitor for one hour. If third-party requests fail, the normal zKillboard link remains.
2. **Official EVE News**: new eve-official-news.js plus netlify/functions/eve-official-news.mjs. Latest official links on Home and News; Pages CMS community posts remain unchanged. Function fetches official feeds server-side.
3. **Official EVE Events**: updated app.js plus netlify/functions/eve-official-events.mjs. Calendar shows verified dated EVE announcements, range dates, official/community filters. The predefined dates for Crimson Harvest, AT XXII Finals, and Fractured Skies need periodic review. Only one-day unambiguous headlines can auto-import; other event announcements are NOT fully automatic.

### Important

- This is STAGED. **Not yet published or live-tested.** Do NOT upload ZIP itself into GitHub; extract it, and upload its files via browser on a non-main branch.
- The project remains hosted on its EXISTING Netlify site; do not create another Netlify project.
- The new `netlify.toml` and `scripts/build-site.mjs` change the publish directory to `dist` so that backend Netlify source code isn't deployed into public site files.
- No secrets, tokens, passwords, or database credentials are contained in this package. Posting/Discord sync remains out of scope.
- Review the Netlify deploy preview and function endpoints before merging to `main`.
- A ZIP snapshot is not automatically kept in sync with later Pages CMS edits. If the site changes between the owner's original download and the upload, retrieve a fresh ZIP, reconcile, then deploy.

### Safe GitHub browser workflow (from home)

1. Visit https://github.com/UnvanquishedGaming/unvanquished-public-site
2. Confirm you're on `main` and click the branch dropdown. Type `feature/eve-integrations-oct2026` and choose **Create branch**.
3. **Once you're on this new branch**, click `Add file` > `Upload files`. Extract the *changed-files-only* ZIP on your own computer and drag its contents (including folders) into the GitHub upload area. Review the list of changed file paths, then commit ONLY to the feature branch.
4. If GitHub web upload doesn't preserve subdirectories, upload the root files first, then navigate into `netlify/functions/` and `scripts/` to add each file in the matching path. Do not upload the ZIP itself.
5. Open a pull request targeting `main` without merging. On Netlify, inspect the corresponding deploy preview (if your free-tier Netlify GitHub connection supports deploy previews); otherwise use GitHub's PR review and a controlled staging build.
6. Check preview: home, news, killboard, calendar; and both JSON endpoints:
   `/.netlify/functions/eve-official-news` and `/.netlify/functions/eve-official-events`.
   News should return `items`; events should return `events`; if official feed is down a fallback is possible. In the calendar visit October/November 2026 and inspect multi-day events. Check mobile layout.
7. Only then merge the PR after your approval, which deploys to Netlify `main` automatically.

### What was tested here

- JavaScript syntax checks for client scripts, build and both functions.
- Local mock feed tests (not live upstream integration) for EVE news/events and zKillboard parsing/rendering.
- Build output includes the site's public assets and excludes serverless function source.
- Existing site pages, CMS JSON content, images and links remain present.

### Known limits

- zKillboard delays publicly accessible API killmails and may omit unshared fights. API requests can fail for some visitors or networks.
- EVE News feed content is updated independently by its provider. Changes to feed schema can require repairs.
- Event importer does NOT interpret arbitrary article bodies or fully automate every multiday event; curated verified dates are provided as seed entries.
- No Discord two-way synchronization is in this release; that requires authorization, bot management and privacy controls.
