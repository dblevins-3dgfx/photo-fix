# Development notes

What isn't written down elsewhere. Read first: [README.md](README.md) (commands, publishing, Pages setup), [CLAUDE.md](CLAUDE.md) (the rules: spec in step, a test for every spec rule, numbered open questions, complexity limit), [SPEC.md](SPEC.md) (what the app does, open and resolved questions), [untested-requirements.md](untested-requirements.md) and [.github/pull_request_template.md](.github/pull_request_template.md).

## How changes are made

- **The owner reviews and merges every PR.** An assistant opens the PR and stops. The owner tries it on an iPhone from the PR's preview, comments on the PR or the issue, then merges.
- **An issue comes first**, with the problem, the change and any options with a recommendation. The PR fixes it: `Fixes #N` in the commit message, and "Fixes #N" at the top of the PR description. Several small issues may share one PR when the owner asks ("Fix 4, 5 and 6 in one PR", [#7](https://github.com/dblevins-3dgfx/photo-fix/pull/7)).
- **Decisions come as issue or PR comments**, often one line ("Don't take over a running page." on #44). Build the option chosen; if an issue offered recommendations and the owner says "use your recommendations", build those.
- **PRs are merged with merge commits** ("Merge pull request #N from …"). There are no releases or tags: a merge to `main` is the release, published by `deploy.yml`.
- **Branches:** every PR so far came from one long-lived branch, `claude/inspiring-wright-ujgeez`, reset to `origin/main` after each merge. That was the assistant session's branch, not a convention; any branch works. Never force-push: after a merge the branch is a fast-forward of `main`.
- **Before starting the next change, check the last PR really merged.** Twice ([#53](https://github.com/dblevins-3dgfx/photo-fix/pull/53), [#56](https://github.com/dblevins-3dgfx/photo-fix/pull/56)) it was reported merged while still open.
- **Commit messages:** a plain sentence saying what changed for the user, a short body, then `Fixes #N` or `Refs #N`.

## Checks

- Before a PR: `npm run typecheck`, `npm run lint`, `npm test`, **and `npm run build`**.
- **CI's `check` job doesn't build.** The build runs only in `publish`, for `main` and same-repository PRs. Build locally to catch:
  - an inline script, which the CSP plugin in `vite.config.ts` refuses (`addCsp` in `src/lib/csp.ts`);
  - `sw.js` generation (`serviceWorker` plugin in `vite.config.ts`).
- Each CI run's summary lists the ten most complex functions. The limit went from 20 ([#38](https://github.com/dblevins-3dgfx/photo-fix/pull/38)) to 15 ([#42](https://github.com/dblevins-3dgfx/photo-fix/pull/42)). Split a growing function into a lookup table or one function per case, as `keyAction` ([#33](https://github.com/dblevins-3dgfx/photo-fix/issues/33)), `gestureStep` ([#34](https://github.com/dblevins-3dgfx/photo-fix/issues/34)) and `photosReducer` ([#35](https://github.com/dblevins-3dgfx/photo-fix/issues/35)) were.

## Running and testing locally

- **The dev server (`npm run dev`) has no service worker and no CSP.** Both are build-only: `src/main.tsx` registers `sw.js` only when `import.meta.env.PROD`. Test offline behaviour and the CSP with `npm run build && npm run preview`, or any static server on `dist/`.
- **A preview build locally:** set `VITE_PREVIEW=<number>` (and optionally `VITE_PREVIEW_URL`) before `npm run build`. It gives the badge and the separate preferences key (`src/storage.ts`).
- **Undoing side effects:** the app stores only preferences (`localStorage`, `photo-fix.prefs` or `photo-fix.preview.<n>.prefs`) and its offline caches (named `photo-fix:<folder>:<version>`). Clear site data in the browser to reset both.
- **Browser automation (Playwright with Chromium) worked well.** Some tricks:
  - **Test images:** make them in the page with `OffscreenCanvas` + `convertToBlob`, and open them with `page.setInputFiles('input[type=file]', …)`. Use about 5000 × 4000 to make decoding slow enough to watch.
  - **Stand-in Save dialog:** stub `window.showSaveFilePicker` in `context.addInitScript`, returning a fake handle whose `createWritable()` records the blob.
  - **Stand-in share sheet:**
    1. delete `showSaveFilePicker` and `showDirectoryPicker`;
    2. set `navigator.canShare = () => true`;
    3. make `navigator.share` reject the first call with `new DOMException('', 'NotAllowedError')`, as Safari does after a long render.
  - **Status text that only shows briefly** ("Opening 2 of 5"): record it with a `MutationObserver` in the page, not by polling `innerText`.
  - **Worker jobs:** wrap `Worker.prototype.postMessage` in an init script to record the job names sent (`region`, `release`, `save`).
  - **Polling:** `page.waitForFunction` with an `async` function never waits, because the Promise it returns counts as truthy. Poll from Node instead.
- **Testing a new version taking over ([#44](https://github.com/dblevins-3dgfx/photo-fix/issues/44)):**
  1. build twice, changing something in `src/worker.ts` the second time so the worker's hash changes too;
  2. serve a folder with `python3 -m http.server`, copying the first build in and later swapping in the second;
  3. wait for `registration.waiting` before closing the page.
- **Two builds side by side ([#43](https://github.com/dblevins-3dgfx/photo-fix/issues/43)):** the live app and a preview share one site. To reproduce that, serve one build at the root and another under `pr-preview/pr-N/`, built with a matching `BASE_PATH`.
- **No unit test can see memory, layout or the real share sheet.** The owner checks those on an iPhone, from the PR preview added to the home screen.

## Gotchas

- **GitHub Pages shows 404 for three to four minutes after a publish**, while its own "pages build and deployment" runs. A brand-new preview link "is 404" until then; wait before reporting it broken.
- **Every build shares one origin** (`dblevins-3dgfx.github.io`), so the live app and every preview share one set of caches. Caches are named per folder and a build only deletes its own ([#43](https://github.com/dblevins-3dgfx/photo-fix/issues/43), [#51](https://github.com/dblevins-3dgfx/photo-fix/pull/51)).
- **A new version doesn't take over an open page** ([#44](https://github.com/dblevins-3dgfx/photo-fix/issues/44)), because an old page would lose its lazily loaded worker script. So on an iPhone an update shows only after the home-screen app is closed from the app switcher and reopened. Tell testers this.
- **`vite.config.ts` lists the files in `public/` by hand** (`publicFiles`). A new file there isn't cached for offline use until it's added to that list.
- **Safari opens the share sheet only soon after a tap.** A long render loses the tap, hence "Ready to save. Tap Share" and the saving states in `src/lib/saving.ts` ([#45](https://github.com/dblevins-3dgfx/photo-fix/issues/45)).
- **Large scans and iPhone memory:** Safari limits a canvas to 16,777,216 px and can stop a worker that uses too much memory. That's why saves have a time limit and restart the worker (`src/lib/job-tracker.ts`, [#29](https://github.com/dblevins-3dgfx/photo-fix/issues/29)), and why memory is freed before saving ([#30](https://github.com/dblevins-3dgfx/photo-fix/issues/30)).
- **A "stuck save" on the iPhone was the Google Drive app,** not Photo Fix. A file saved through **Save to Files → Google Drive** can spin in the Drive app's upload after Photo Fix has handed it over (discussed on [#28](https://github.com/dblevins-3dgfx/photo-fix/pull/28), [#29](https://github.com/dblevins-3dgfx/photo-fix/issues/29)).
- **Logic that lived inside components hid bugs.** One-finger drag never panned, because the distance was computed when it was always zero; this was found only when moving gestures into `src/lib/gesture.ts` ([#27](https://github.com/dblevins-3dgfx/photo-fix/pull/27)). That's why logic now goes into `src/lib`, with components only calling it.
- **Implicit state machines have caused bugs:** Compare sticking on ([#46](https://github.com/dblevins-3dgfx/photo-fix/issues/46)), shortcuts working behind a dialog ([#47](https://github.com/dblevins-3dgfx/photo-fix/issues/47)), saving ([#45](https://github.com/dblevins-3dgfx/photo-fix/issues/45)) and opening ([#48](https://github.com/dblevins-3dgfx/photo-fix/issues/48)). Each was fixed by turning the state into a reducer or a set in `src/lib`. Prefer that shape for anything new with more than two states.
- **A new dialog must call `useModal()`** (`src/hooks/useShortcut.ts`), or keyboard shortcuts fire behind it.

## Decisions and the owner's preferences

- **The devices are an iPhone (Safari, home-screen app) and a Chromebook.** The scanner saves JPEG only (why TIFF was dropped, Q2), and photos live in Google Drive.
- **Wording:** plain English, short sentences, no jargon, in the app and in the spec. Status messages say only what the app knows: "Shared" or "Downloaded", never "Saved" when it can't tell ([#4](https://github.com/dblevins-3dgfx/photo-fix/issues/4), [#5](https://github.com/dblevins-3dgfx/photo-fix/issues/5)). A message is never cut off ([#6](https://github.com/dblevins-3dgfx/photo-fix/issues/6)).
- **The spec describes the app as it is**, not a "first version" (comment on [#54](https://github.com/dblevins-3dgfx/photo-fix/pull/54)).
- **When asking the owner to choose,** give lettered options with one marked "(Recommended)" and the reason, then wait for the answer.
- **Architecture:** the refactors in [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10)/[#23](https://github.com/dblevins-3dgfx/photo-fix/pull/23) and [#11](https://github.com/dblevins-3dgfx/photo-fix/issues/11)/[#26](https://github.com/dblevins-3dgfx/photo-fix/pull/26) were done so a feature touches few files. They gave worker jobs (one file per job in `src/jobs/`), `useShortcut`, a testable save loop, and tables of adjustments and preferences. Keep new features in that shape.
- **No network requests besides the app's own site,** enforced by the CSP. A Google Drive connection (Q8's third option) would break that promise.

## Setup outside the repository

- **GitHub Pages:** Settings → Pages → Source "Deploy from a branch", `gh-pages`, `/ (root)`. There is no custom domain.
- **No analytics, no search console, no scheduled jobs.** Dependabot (`.github/dependabot.yml`) updates the pinned Actions weekly.
- **Unverified:** whether Dependabot's PRs can publish a preview. Their workflow token is usually read-only, so the `publish` job may fail on them while `check` passes.

## Things to watch for

- **iPhone-only behaviour** can't be checked from CI or headless Chromium: memory, the share sheet, Files and Drive. Ask the owner to try it on the preview, and say in the PR what wasn't tried.
- **Not yet confirmed on a real Chromebook:** Chrome's Save dialog and Save all into a folder (SPEC.md section 12).
- **The 3-minute save time limit** (`TIME_LIMIT_MS` in `src/lib/job-tracker.ts`) was a guess, not timed on an iPhone.

## Open work

- **[#49](https://github.com/dblevins-3dgfx/photo-fix/issues/49), the eyedropper's prompt vanishing while it is still armed.** Needs the owner's pick. Recommended: a save result or "couldn't open" message doesn't replace the prompt while armed.
- **[#31](https://github.com/dblevins-3dgfx/photo-fix/issues/31), a "Recent problems" list.** Needs two answers: whether to keep file names, and Preferences or a ⚠ badge. A new dialog must call `useModal()`.
- **[#36](https://github.com/dblevins-3dgfx/photo-fix/issues/36): move App's shortcuts into `usePhotoShortcuts`.** Optional, with no visible change.
- **Open questions Q3–Q10** ([#13](https://github.com/dblevins-3dgfx/photo-fix/issues/13)–[#19](https://github.com/dblevins-3dgfx/photo-fix/issues/19), options in SPEC.md section 9):
  - Their **Depends on** refactors (#10, #11) are all merged, so none is blocked.
  - **Q8 ([#17](https://github.com/dblevins-3dgfx/photo-fix/issues/17)) needs no code** if the Save dialog stays: record it in Resolved questions and close it.
  - **Q3** (full size on an iPhone) relates to the memory work in #30.
