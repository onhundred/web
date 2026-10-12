# Onhundred: home page

The production home page for Social Experiment 001. It is a static, prerendered page in English (`/`) and Spanish (`/es/`), deployed on Cloudflare Pages. The build has no runtime framework or dependencies, and every byte is budgeted.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Renders `dist/` for both languages, then runs the byte budget. Fails if any budget is exceeded. |
| `npm run perf` | Serves `dist/` on a throwaway port with Brotli and runs Lighthouse mobile on `/` and `/es/`. Fails below Performance 100, LCP 1.5s, CLS 0, TBT 50ms. Reports go to `.perf/`. |
| `npm run preview` | Serves `dist/` at http://localhost:8788 to check the built site. |
| `npm test` | Checks the shared protocol rules and the app's writes in Node. `cd app && npm test` also runs the Worker in the local Workers runtime. |
| `npm run fonts` | Re-subsets the self-hosted fonts from the variable TTFs in `/tmp/fonts` (`Archivo.ttf`, `MartianMono.ttf` from github.com/google/fonts). Needs Python `fonttools` and `brotli`. |

## Where things live

- `src/index.html`: the one template. Slots are `{{t.*}}` for copy, `{{c.*}}` for config and `{{d.*}}` for computed values; triple braces insert raw HTML.
- `src/i18n/en.json`, `src/i18n/es.json`: every word on the page. The Spanish copy is a draft and needs the owner's review.
- `app/`: the one-click protocol app (Worker, MCP server, D1). See [app/README.md](app/README.md). The site build reuses three things from it:
  - `app/protocol.json`: areas, ceilings, triage thresholds and limits from the protocol.
  - `app/lib/protocol.mjs`: the rules. `validate()`, `derive()` (flags, statuses, metrics), `publicView()` (the privacy allowlist) and `renderGrid()`.
  - `app/seed/`: sample data (100 loops, 8 experiments, cycle 16). Used only for local and preview builds, labeled SAMPLE.
- `src/config.json`: site URL, external links, form endpoints (`observeAction`, `submitAction`) and the optional `voteUrl`. The vote link only renders when `voteUrl` is set.
- `src/assets/css/site.css`: the whole stylesheet. It is inlined into each page at build time.
- `src/assets/js/grid.js`: the only script, under 2KB Brotli. It handles tapping an area or a stage to isolate its cells while the figure recounts, and the loop tooltip on hover or tap. The page works without it.
- `src/assets/fonts/`: Archivo (variable) and Martian Mono, subset to Latin, with their OFL licenses.
- `src/brand/`: favicon, apple-touch-icon and the social card, copied from `memory-bank/onhundred-logo-kit/` to the root of `dist/`.
- `src/_headers`: Cloudflare cache rules. Hashed `/assets/*` files are immutable for a year, brand files cache for a day, HTML always revalidates.
- `scripts/build.mjs`, `scripts/check-budget.mjs`, `scripts/perf.mjs`: the build, the byte gate and the Lighthouse gate.
- `scripts/sync-app-assets.mjs`: copies the newest `memory-bank/Onhundred Protocol v*.md`, `LOOPS.md`, `VOICE.md` and the brand files into `app/`, so the app stays self-contained. Run it after editing any of them. It stops if the newest protocol file and `app/protocol.json` disagree on the version.
- `reference/`: the original design mockup, kept for reference only. It is not deployed.
- `DESIGN.md`, `PRODUCT.md`, `.impeccable/`: the design system, the product brief and the approved comp.

## Budgets

| Budget | Limit |
| --- | --- |
| HTML + inline CSS per page (Brotli) | 20KB |
| JavaScript total (Brotli) | 3KB |
| Fonts total | 80KB, at most 2 preloads |
| Rasters above the fold | none |

## Where the numbers come from

Each square on the grid is one loop: a recurring responsibility, with a code like `R-PAR-01`. The 100 loops and the experiments that move them live in Ale's own install of the protocol app, and agents edit them through its MCP server.

- **Production builds** fetch `LOG_URL/public.json` (for example `https://log.onhundred.com/public.json`). The build fails if `LOG_URL` is missing, the fetch fails or the response doesn't pass `checkPublic()`. Cloudflare Pages then keeps the previous deploy live, so visitors never see sample data or a broken log. Production means `CF_PAGES=1` on the `PRODUCTION_BRANCH` (default `main`).
- **Local and preview builds** without `LOG_URL` render `app/seed/` and show the SAMPLE tags. Set `LOG_URL` locally to preview the real log.
- **The hero figure** is the site's own metric, not the protocol's: `100 − (delegated + autonomous + 0.5 × assisted) / loops × 100`. An assisted loop counts as half handed over. The per-area captions use the same formula within each branch. The protocol's main metric, Delegated, is `(delegated + autonomous) / 100`.
- **Cell order** is a seeded shuffle per branch (`meta.grid.seeds`), with loops that have a `visibility` value moved to the front.
- **Rebuilds:** Ale's install calls the Pages deploy hook (`PUBLISH_HOOK_URL`) after approved writes, so the site follows the log within a few minutes.

## Deploying to Cloudflare Pages

Set the build command to `npm run build` and the output directory to `dist`. Node 20 or newer is required. Set `LOG_URL` in the production environment variables.

The forms post to `/api/observe` and `/api/submit`. Point them at real endpoints (for example Pages Functions) in `src/config.json` before launch.

## Releasing the app

Installs don't follow `main`. Each install's **Update from template** workflow (`app/.github/workflows/update-from-template.yml`) looks for the newest tag named `app-vX.Y.Z` and opens a pull request with it. Publishing an update is one deliberate step:

```bash
npm run build && npm test && (cd app && npm test)
gh release create app-v1.1.0 --title "App v1.1.0" --notes "Protocol v1.1: assisted counts half in Delegated; decide and choose fail as loop names."
```

The release notes are what owners read before merging, so say what changes for them. When a release ships a new protocol version:

1. Add `memory-bank/Onhundred Protocol vX.Y.md` with its changelog entry, and set `version` in `app/protocol.json` to match.
2. Version the rule changes in `app/protocol.json` (`naming.since`, `metrics.assistedWeight`, `changes`), so logs that haven't adopted it keep the old rules.
3. Run `npm run sync-app`.

Database changes are additive only (new tables or columns, never `DROP` or `RENAME`), so an install can always roll back to older code. A test checks it.
