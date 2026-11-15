# Coach dashboard (strokewise.app/coach/)

Static, no build step. A coach signs in with the email + password of the coach account made in the StrokeWise app and sees the athletes on their team. Read-only.

- `index.html`, `coach.css` – page shell and styles (same look as the marketing site).
- `config.js` – Firebase web key + database URL (both public, same as the app's `config.js`) and the athlete invite link base.
- `api.js` – Firebase Auth + Realtime Database over plain REST (same calls as the app's `sync.js`); session kept in `localStorage`.
- `analyze.js` – per-athlete numbers (summary row, detail page) built on the app's own maths.
- `charts.js`, `app.js` – SVG charts and the screens (hash routes `#/` and `#/a/<athlete id>`).
- `lib/` – `sg.js`, `mygame.js`, `trends.js`, `shortgame.js` copied unchanged from the app repo (golf-shot-tracker v216, 2d85a50). Re-copy them when the app's maths changes.

Data read: `/coaches/<uid>`, `/teams/<id>/info`, `/teams/<id>/members`, `/data/<athlete uid>`. Nothing is written.

## Full read-only review (v2)

Everything a coach sees in the app's athlete review is on the site, with hash routes so back, forward and links work. Nothing opens the app.

Routes (after `#/a/<athlete id>`): *(overview)* · `rounds` · `round/<id>` · `round/<id>/hole/<n>` · `round/<id>/birdie` · `stats` · `mygame` · `trends` · `compare` · `skill/<drive|irons|wedges|chip|bunker|putt>` · `practice` · `practice/<id>` · `plan` · `tests` · `test/<id>` · `tests/trend`.

- `pages.js` – the athlete pages. Native desktop layouts for rounds, round, hole, practice, tests and skills. Stats, My Game, Trends, Practice plan, Compare and Birdie zone are the app's own panels inside `.appui`.
- `lib/appviews.js` – GENERATED. The app's view code (stats, my game, trends, plan, scorecard, maps, replay, test screens) cut out of the app's `app.js` with its dependencies, run against a read-only stand-in for the phone. Never edit by hand.
- `appui.css` – GENERATED. The app's CSS scoped under `.appui`.
- `lib/*.js` – the app's pure modules, copied unchanged (`sg`, `mygame`, `trends`, `shortgame`, `shortgame-ui`, `bag`, `birdie`, `insights`, `plan`).
- Regenerate after the app changes: `NODE_PATH=<dir with acorn, postcss, eslint-scope> node dev/port/extract-app.js <app>/app.js > coach/lib/appviews.js` and `node dev/port/scope-css.js <app>/styles.css > coach/appui.css`.
- Only view acts are allowed (`ALLOWED` in `pages.js`); anything that would edit, log, start a session or open a data-entry screen is dropped and its button hidden.
- "New" tags: an item is New if it is newer than the coach's first look at that athlete and not opened yet. Opening it clears it. Kept in the browser (`localStorage`), never written to the database. Every tag and alert links to its item.
- Benchmark: the athlete's own, changeable per page.

Not ported, on purpose: Bag, Wedges chart, Courses, Settings, PDF/story/backup, Drive/sync, hole data entry, session start/log, any edit or delete.

## Tests (dev/coach-test)

- `node dev/coach-test/calc.test.js` – maths against the app's own modules, seen model, flag links, skill pages.
- `node dev/coach-test/run.js <out dir>` – seeded fake Firebase and Playwright (playwright-core, system Chrome). About 90 checks, screenshots into `<out dir>`.
- `dev/coach-test/explore.js` – scratch helper to screenshot routes (`FULL=1`, `OVER=1`, `GREP=…`).
