# ArgoBeat Build Versioning

## How It Works

ArgoBeat uses a two-tier version system:

1. **Release version** — `v0.2.0`, `v0.3.0`, etc. User-facing. Only changes when you intentionally cut a release.
2. **Build number** — `Build 2026.06.06.3`. Tracks iterations within a release. Only shows after release.

## Version Display

The footer on every page shows:

**Before release:**
```
ArgoBeat v0.2.0
```

**After release:**
```
ArgoBeat v0.2.0
Build 2026.06.06.3
```

Hover shows the git commit SHA.

## Files Involved

- `apps/web/src/version.json` — single source of truth for version/build data
- `apps/web/src/components/BuildVersion.astro` — renders the footer display
- `apps/web/src/layouts/Base.astro` — includes BuildVersion in the footer

## version.json Structure

```json
{
  "release": "v0.2.0",
  "released": false,
  "buildDate": "2026.06.06",
  "buildNum": 0,
  "commit": "ea56671"
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `release` | string | Release version label (e.g. `v0.2.0`) |
| `released` | boolean | `false` = dev mode (no build number shown). `true` = released (build number shown) |
| `buildDate` | string | Date of the build in `YYYY.MM.DD` format |
| `buildNum` | integer | Iteration count within the release. Starts at 1, increments per build |
| `commit` | string | Short git SHA of the current build |

## Workflow

### During development (before release)
- `released` is `false`
- `buildNum` stays at 0
- Footer shows: `ArgoBeat v0.2.0`

### When you release
1. Set `"released": true`
2. Set `"buildNum": 1`
3. Update `buildDate` to today
4. Update `commit` to current SHA
5. Push

### After each build/deploy
1. Increment `buildNum` by 1
2. Update `buildDate` if it's a new day
3. Update `commit` to current SHA
4. Push

### When you cut a new release (e.g. v0.3.0)
1. Update `release` to new version (e.g. `"v0.3.0"`)
2. Reset `buildNum` to 0
3. Set `"released": false` until you're ready to start counting builds
4. Push

## Build Number Format

`Build YYYY.MM.DD.N`

- `YYYY.MM.DD` = build date
- `N` = iteration number for that day/release

Example progression:
```
Build 2026.06.06.1   ← first build on release day
Build 2026.06.06.2   ← second build same day
Build 2026.06.07.1   ← first build next day
Build 2026.06.15.12  ← 12th build, a week later
```

## AI/Automation Notes

- This is **not** using git hooks or CI automation
- The version.json is **manually edited** before each push
- The `version.json` file is in `.gitignore` but should be force-added (`git add -f`) when committing
- Other AIs/agents working on this repo should update version.json as part of their commit workflow
- The `released` flag controls whether build numbers appear — keep it `false` during development

## Changelog

Keep `CHANGELOG.md` updated with every meaningful change. Group by version, use categories: Added, Fixed, Changed, Docs. Update it in the same commit as the code change.

## Quick Reference for AI Agents

When making a build commit to ArgoBeat:
1. Read `apps/web/src/version.json`
2. Increment `buildNum` by 1
3. Update `buildDate` to today (YYYY.MM.DD)
4. Update `commit` to the short SHA you're about to push
5. If `released` is `false`, leave it — no build number shows
6. Update `CHANGELOG.md` with what changed
7. Commit and push
