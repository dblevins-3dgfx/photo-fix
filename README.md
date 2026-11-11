# Photo Fix

Color correction for scanned photographs, in the browser. Open a scan, let **Auto** take out the fading and the color cast, touch it up with a white-point eyedropper and a few sliders, and save it back at full size. It runs on a Chromebook and on an iPhone, and can be added to the home screen like an app. Photos never leave the device: there is no server and nothing is uploaded.

[SPEC.md](SPEC.md) describes exactly what it does, and lists the decisions still open.

## On a phone

On an iPhone, open the app in Safari and use **Share → Add to Home Screen**. It then opens full screen from its own icon, and works offline. Its preferences are kept apart from Safari's. **Save** opens the share sheet: **Save Image** puts the photo in Photos, **Save to Files** in any folder, Google Drive included.

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server also listens on your local network, so you can try it from a phone at the network address Vite prints.

## Publishing

Every push to any branch, and every pull request, runs the typecheck, the linter and the unit tests. Once they pass, `.github/workflows/deploy.yml` publishes `main` and pull requests to GitHub Pages from the `gh-pages` branch. It is a static site, so there is no server to run.

- **`main`** is the live app: `https://dblevins-3dgfx.github.io/photo-fix/`.
- **Each pull request** gets a preview: `https://dblevins-3dgfx.github.io/photo-fix/pr-preview/pr-<number>/`. One comment on the pull request links to it and is kept up to date. Each push rebuilds it; closing or merging the pull request removes it.

A preview shows a small **Preview #<number>** badge linking to its pull request, and keeps its own preferences, copied from the live app's the first time it opens. A pull request from a fork gets the checks but no preview.

One-time setup: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**. The first workflow run creates the branch.

## Working on it

Changes go through pull requests: see `CLAUDE.md` for the rules (keep `SPEC.md` current, test every spec rule) and `.github/pull_request_template.md` for the checklist.

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Check the types |
| `npm run lint` | Lint (oxlint; warnings fail, and so does any function with a cyclomatic complexity of 16 or more) |
| `npm test` | Run the unit tests |
