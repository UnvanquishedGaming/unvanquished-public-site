# Member profiles on the About page

The About page reads `content/members.json`. Only approved profiles display.

## Publishing workflow

1. Obtain a member's questionnaire answers and permission to display their submitted information publicly.
2. Add one object inside `profiles` in `content/members.json`. Keep private details and unpublished quotes out of this public repository.
3. Assign `tier`: `ceo` for the current CEO, `leadership` for other confirmed officers/leaders, or `member` for everyone else. `sortOrder` (lower first) controls order within each tier.
4. Set `approvedForPublicSite` to `true` only when the member has explicitly approved publication. Otherwise do not publish the entry.
5. Review the Deploy Preview visually before merging to the public site.

Example entry (illustrative only; do not copy fake members into production):

```json
{
  "tier": "member",
  "sortOrder": 10,
  "eveName": "Example Capsuleer",
  "discordName": "Example Discord Name",
  "roleTitle": "",
  "introduction": "",
  "games": ["Satisfactory", "X4 Foundations"],
  "memory": "An example of a favorite shared moment.",
  "approvedForPublicSite": false
}
```

The profile must include `eveName`, a valid `tier`, and `approvedForPublicSite: true` to be displayed. Optional fields: `discordName`, `roleTitle`, `introduction`, `games`, `memory`, and `sortOrder`. Answers are displayed as plain text to prevent injected HTML. Leadership is not inferred from names; verify actual ranks before assigning the CEO or leadership tier.

The page only displays the sections that have approved profiles. If no approved profiles exist, the original "Member introductions are coming" placeholder remains.
