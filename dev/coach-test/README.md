# Coach site tests (fake data only)

- `node dev/coach-test/calc.test.js` – the coach numbers against the app's own maths (`coach/lib/` is the app's code, copied unchanged).
- `node dev/coach-test/run.js [outDir]` – headless Chrome walks the coach site against a stand-in Firebase (`fakefirebase.js`, copied from the app's tests) seeded by `seed.js` with 10 fake athletes.
  Google's real endpoints are intercepted in the browser, so nothing real is touched. Writes screenshots to `outDir` (default `/workspace/coach-shots`).
  Needs `playwright-core` and `/usr/bin/google-chrome`.

Everything in `dev/` is for development only and is not linked from the site.
