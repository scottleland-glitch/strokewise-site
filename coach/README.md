# Coach dashboard (strokewise.app/coach/)

Static, no build step. A coach signs in with the email + password of the coach account made in the StrokeWise app and sees the athletes on their team. Read-only.

- `index.html`, `coach.css` – page shell and styles (same look as the marketing site).
- `config.js` – Firebase web key + database URL (both public, same as the app's `config.js`) and the athlete invite link base.
- `api.js` – Firebase Auth + Realtime Database over plain REST (same calls as the app's `sync.js`); session kept in `localStorage`.
- `analyze.js` – per-athlete numbers (summary row, detail page) built on the app's own maths.
- `charts.js`, `app.js` – SVG charts and the screens (hash routes `#/` and `#/a/<athlete id>`).
- `lib/` – `sg.js`, `mygame.js`, `trends.js`, `shortgame.js` copied unchanged from the app repo (golf-shot-tracker v216, 2d85a50). Re-copy them when the app's maths changes.

Data read: `/coaches/<uid>`, `/teams/<id>/info`, `/teams/<id>/members`, `/data/<athlete uid>`. Nothing is written.
