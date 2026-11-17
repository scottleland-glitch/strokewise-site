# Coach dashboard (strokewise.app/coach/)

Static, no build step. A coach signs in with the email + password of the coach account made in the StrokeWise app and sees the athletes on their team. Read-only.

- `index.html`, `coach.css` – page shell and styles (same look as the marketing site).
- `config.js` – Firebase web key + database URL (both public, same as the app's `config.js`) and the athlete invite link base.
- `api.js` – Firebase Auth + Realtime Database over plain REST (same calls as the app's `sync.js`); session kept in `localStorage`.
- `analyze.js` – per-athlete numbers (summary row, detail page) built on the app's own maths.
- `charts.js`, `app.js` – SVG charts and the screens (hash routes `#/` and `#/a/<athlete id>`).
- `lib/` – `sg.js`, `mygame.js`, `trends.js`, `shortgame.js` and the rest copied unchanged from the app repo (golf-shot-tracker v232, 612eb34). Re-copy them when the app's maths changes.

Data read: `/coaches/<uid>`, `/teams/<id>/info`, `/teams/<id>/members`, `/data/<athlete uid>`. Nothing is written.

## Full read-only review (v2)

Everything a coach sees in the app's athlete review is on the site, with hash routes so back, forward and links work. Nothing opens the app.

Routes (after `#/a/<athlete id>`): *(overview)* · `rounds` · `round/<id>` · `round/<id>/hole/<n>` · `round/<id>/birdie` · `stats` · `mygame` · `trends` · `compare` · `skill/<drive|irons|wedges|chip|bunker|putt>` · `practice` · `practice/<id>` · `plan` · `tests` · `test/<id>` · `tests/trend`.

- `pages.js` – the athlete pages. Native desktop layouts for rounds, round, hole, practice, tests and skills. Stats, My Game, Trends, Practice plan, Compare and Birdie zone are the app's own panels inside `.appui`.
- `lib/appviews.js` – GENERATED. The app's view code (stats, my game, trends, plan, scorecard, maps, replay, test screens) cut out of the app's `app.js` with its dependencies, run against a read-only stand-in for the phone. Never edit by hand.
- `appui.css` – GENERATED. The app's CSS scoped under `.appui`.
- `lib/*.js` – the app's pure modules, copied unchanged (`sg`, `mygame`, `trends`, `shortgame`, `shortgame-ui`, `bag`, `birdie`, `insights`, `plan`, `weekahead`).
- Regenerate after the app changes: `NODE_PATH=<dir with acorn, postcss, eslint-scope> node dev/port/extract-app.js <app>/app.js > coach/lib/appviews.js` and `node dev/port/scope-css.js <app>/styles.css > coach/appui.css`.
- Only view acts are allowed (`ALLOWED` in `pages.js`); anything that would edit, log, start a session or open a data-entry screen is dropped and its button hidden.
- "New" tags: an item is New if it is newer than the coach's first look at that athlete and not opened yet. Opening it clears it. Kept in the browser (`localStorage`), never written to the database. Every tag and alert links to its item.
- Benchmark: the athlete's own, changeable per page.

## Practice tab (app v230 Practice screen)

`#/a/<id>/practice` shows the app's Practice screen card by card, two columns on a computer, one on a phone, then the full session table. The cards are the app's own code, generated: `extract-app.js` now also roots `weekCardHTML`, `gapCardHTML`, `practiceCardHTML`, `playingCardHTML`, `recentDaysHTML`, `planCardHTML`, and `shim.js` exposes them as `APPVIEWS.practice.{week, gap, spider, vs, recent, playing, plan}`, built with the same arguments as the app's `practicePageHTML` (and `myGameHTML` for My Practice).

- **Your week ahead** (`ahead`, full width on top): v232 shows it to a coach, read-only (no ✕, no Start this week).
- **This week slider** (`week`): page 1 each area against its weekly target, page 2 "Each day, by group", page 3 "Last 3 months · rolling 7 days" with 🏆, lessons and the dashed target. ‹ › in the header change the week.
- **Your game and your training** (`gap`): strokes lost per round against practice per week, by skill.
- **My Practice** (`spider`, from My Game): this week, 30 days and 3 months against the benchmark group.
- **Strokes lost vs practice time** (`vs`): share of strokes lost against share of practice time (uses the page's period buttons).
- **Recent practice** (`recent`): one row per day; open a day, click a session for `practice/<id>`.
- **Playing and practice · by week** (`playing`): hours on the course against practice hours.
- The Practice plan sub-tab is now just the app's plan list (`plan`), since the rest lives on the Practice tab.

Hand-written on the web side (`pages.js` / `app.js`), not generated:
- `swipers()`: the app's `swipeCard()` without full screen – dots follow the swipe, the page survives a re-render (`view.wkPage` / `view.prPage`), and ‹ › plus clickable dots on a computer (the arrows hide on touch screens).
- `prCards()` tidy-up: removes the tap-for-full-screen on the two swipe cards and turns each Recent practice session into a link to its practice page.
- `openDay()`: clicking a day on "Each day, by group" opens that day in Recent practice and scrolls to it (the app opens a sheet instead).
- "Compare with …" on Playing and practice is kept in page memory only (`APPVIEWS.pref`), never saved.
- Left out: Log practice, +, Start a session, the typical-week card, the mode switches, and every edit or delete.

Not ported, on purpose: Bag, Wedges chart, Courses, Settings, PDF/story/backup, Drive/sync, hole data entry, session start/log, any edit or delete.

## Tests (dev/coach-test)

- `node dev/coach-test/calc.test.js` – maths against the app's own modules, seen model, flag links, skill pages.
- `node dev/coach-test/run.js <out dir>` – seeded fake Firebase and Playwright (playwright-core, system Chrome). About 90 checks, screenshots into `<out dir>`.
- `node dev/coach-test/practice-shots.js <out dir>` – screenshots of the Practice tab: full page, each slider page, each card, phone width with an overflow check.
- `dev/coach-test/explore.js` – scratch helper to screenshot routes (`FULL=1`, `OVER=1`, `GREP=…`).
