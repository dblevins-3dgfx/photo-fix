# Photo Fix: Specification

Status: a draft, written before any code. Nothing described here is built yet. Once code exists, this file describes the app as implemented, and the first code pull request replaces this note with a list of where each part lives. Decisions still to be made are listed under [Open questions](#9-open-questions), each with the option the first version builds. Decided questions go under [Resolved questions](#11-resolved-questions).

## 1. Overview

A web app for color-correcting scanned photographs, on a Chromebook (Chrome) and an iPhone (Safari). Old prints fade unevenly: the cyan dye usually goes first, leaving a red or magenta cast, washed-out blacks and dull color. Photo Fix stretches each color channel back to full range (**Auto**), lets you mark something that should be neutral gray or white (**White point**), offers a few sliders for the rest, and saves the result at full size.

Everything happens on the device. Photos are read from files you choose, processed in the browser, and saved back as new files. There is no server, no account and no upload, and the app works offline once it has been opened.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional components, hooks) |
| Build | Vite, TypeScript (`strict` on) |
| Styling | Tailwind CSS v4 utility classes |
| Icons | lucide-react |
| Image work | Decoding with `createImageBitmap`; pixels read and written as `ImageData` on a canvas; full-size processing and encoding in a Web Worker with `OffscreenCanvas`, so the screen stays responsive. The pixel math lives in `src/lib` as plain functions on `Uint8ClampedArray`s |
| Tests | Vitest (`npm test`), unit tests in `src/lib/*.test.ts` |
| Checks | `npm run typecheck` (tsc), `npm run lint` (oxlint, warnings are errors), `npm test` |
| Persistence | Preferences only, in localStorage under keys starting `photo-fix.` (section 8). Photos are never stored |
| Home screen | Installable: `public/manifest.webmanifest` names it Photo Fix and opens it full screen (`standalone`), with 192 and 512 px icons; `index.html` adds Apple's tags (180 x 180 `apple-touch-icon.png`, full-screen capable, the title, status bar style). On an iPhone: Safari, Share, Add to Home Screen. Opened from the home screen it keeps its own storage, separate from Safari's |
| Offline | A service worker caches the app's files on the first visit, so later visits open without the network. A new version is picked up on the next visit after it is published |
| Touch | The page reaches under the notch and home bar (`viewport-fit=cover`) and pads itself back in by the safe-area insets. Double-tap zoom, text selection, the long-press callout and the tap highlight are turned off on the controls (not on the photo, which handles its own touches) |
| Security | A Content Security Policy in a `<meta>` tag in the built `index.html` (GitHub Pages can't send it as a header) lets the page load and contact nothing but its own site, so the browser itself enforces that photos never leave the device (section 8). The policy is `contentSecurityPolicy()` in `src/lib/csp.ts`, added by the build: `default-src 'self'`; `script-src 'self'` (no inline scripts, no `eval`); `style-src 'self' 'unsafe-inline'` (React writes style attributes, such as a slider's position); `img-src 'self' blob: data:` (previews and thumbnails are drawn from blobs); `worker-src 'self'` (the Web Worker and the service worker); `connect-src 'self'`; `manifest-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'none'`. The build fails if the built `index.html` has an inline script, which the policy would block. The dev server (`npm run dev`) runs without it, since Vite's hot reload uses inline scripts |
| Light and dark | The controls follow the device's light or dark setting (`prefers-color-scheme`) and switch at once when it changes; nothing is stored. The photo area is the same mid-gray (sRGB 128, 128, 128) in both, so the backdrop never changes how a photo's colors look. The theme color (the iPhone's status bar, Chrome's title bar) follows too |
| Publishing | GitHub Pages, from the `gh-pages` branch, by `.github/workflows/deploy.yml` (section 10) |
| Dependency updates | Dependabot, weekly, for the GitHub Actions the workflow uses |

## 3. Opening photos

- **Open photos** (a button, on the empty screen and in the toolbar) opens the system file picker, which accepts several files at once. On an iPhone it offers the photo library, Files and the camera; on a Chromebook, the Files app. Google Drive is reachable from both: the iPhone's Files app lists it once the Google Drive app is installed and turned on as a location, and the Chromebook's Files app lists it beside Downloads. The app itself never talks to Google; the system's picker does.
- On a Chromebook, photos can also be dropped onto the window, or pasted (Ctrl+V) from the clipboard.
- **Formats:** JPEG, PNG and WebP. An iPhone's HEIC photos arrive as JPEG through the photo picker. A file the browser can't decode (HEIC from Files on a Chromebook, TIFF, RAW) is skipped with a message naming the file, saying the format isn't supported, and suggesting JPEG or PNG instead. TIFF isn't supported (Resolved questions, **Q2**).
- **Orientation:** a photo's EXIF orientation is applied when it is decoded, so it shows the way up the camera or scanner meant.
- **Color profiles:** the browser converts a photo with an embedded color profile (Adobe RGB, for example) to sRGB when it decodes it. All the correction works in sRGB.
- **Bit depth:** the browser decodes every photo to 8 bits per channel, so a 16-bit PNG is corrected and saved at 8 bits.
- Opening more photos adds them to the ones already open, after them. Each photo is listed by its file name.
- When a photo is opened, its settings start at the defaults (section 4, **Settings**), with **Auto** on or off according to the **Auto on for new photos** preference (section 8).

### Sizes

- Each open photo keeps three sizes: the **original** at full size (kept as the decoded bitmap), the **analysis image**, the photo scaled so its longer side is at most 1024 px (never scaled up), and the **preview**, scaled to fit the photo area at the screen's pixel density, at most 2048 px on the longer side.
- Auto's statistics and the white point's sample are always taken from the analysis image, never from the preview or the original, so they don't depend on the screen and the preview shows exactly the correction that is saved (rule: **Same correction everywhere**, section 4).
- A photo larger than the device can handle in one canvas is an open question (**Q3**). The first version scales such a photo down when saving and says so (section 7).

## 4. Corrections

### Values

Each channel value is an 8-bit number 0 to 255. The math below treats it as `v = value / 255`, from 0 to 1. Every step clamps its result to 0 to 1. The last step rounds `v * 255` to the nearest whole number.

### Order

The corrections apply in this order, each to the result of the one before:

1. Auto (per-channel levels)
2. White point
3. Warmth and Tint
4. Brightness
5. Contrast
6. Saturation

Steps 1 to 5 act on each channel on its own, so they are combined into one 256-entry table per channel, built once whenever the settings change, and applied to every pixel with a table lookup. Step 6 mixes the channels and is applied per pixel after the tables.

- **Identity:** with Auto off and every other setting at its default, the output is the input exactly, value for value.
- **Same correction everywhere:** the preview, the original at full size and every save use the same tables and the same saturation, built from the same settings and the same analysis-image statistics.
- Rotation (section 6) does not change any value, only where it is.

### Auto

Per-channel levels: stretches each of red, green and blue so its darkest and lightest values reach black and white. This removes most color casts from faded prints, because each dye faded by a different amount. Whether Auto should also even out the midtones is an open question (**Q1**).

- **Where it measures:** a histogram of each channel over the analysis image, leaving out a margin of 2% of the width at the left and right and 2% of the height at the top and bottom (rounded down to whole pixels), so the scanner lid or bed around the print doesn't count.
- **Black and white points:** for each channel, `lo` is the lowest value with at least 0.5% of the measured pixels at or below it, and `hi` is the highest value with at least 0.5% of the measured pixels at or above it. Both are found on the 0 to 255 histogram and then divided by 255.
- **Flat channels are left alone:** a channel with `hi - lo` below 0.1 (a photo that is nearly one color, or blank) is not stretched.
- **Stretch:** otherwise, `auto(v) = (v - lo) / (hi - lo)`, clamped to 0 to 1.
- **Strength:** a slider from 0% to 100%, default 100%, blends between the photo and the stretch: `v + strength * (auto(v) - v)`. At 0% Auto changes nothing. The slider is shown only while Auto is on.
- **On and off:** Auto is a switch. Turning it off keeps the strength, so turning it on again restores it.
- The statistics (`lo` and `hi` per channel) are measured once, when the photo is opened. They don't depend on any setting.

### White point

The eyedropper: tap (or click) something in the photo that should be neutral, such as a white border, a gray sky or a white shirt, and the photo's colors are balanced so it is.

- **White point** is a button that arms the eyedropper. While it is armed, the status line says "Tap something that should be white or gray". The next tap on the photo samples it; tapping the button again or pressing Escape disarms it without sampling.
- **Sample:** the average of each channel over a 5 x 5 block of the analysis image centered on the tapped point (clipped at the photo's edges), after Auto (step 1) has been applied. The point is mapped from the screen to the analysis image through the current rotation.
- **Too dark:** if any channel of the sample is below 0.04, the tap is refused, the eyedropper stays armed, and the status line says "Too dark to judge. Pick something lighter".
- **Gains:** with the sample's channels `r`, `g`, `b` and their mean `m = (r + g + b) / 3`, each channel is multiplied by `m / r`, `m / g` and `m / b`. That makes the sample gray without changing its brightness. Each gain is clamped to 0.5 to 2.
- The gains are kept, not the point, so the White point stays when other settings change. A new sample replaces the old one. **Clear** (beside the button, shown only while a white point is set) removes it.
- Changing Auto (on, off or strength) after a white point was picked keeps the gains as they are. (They were measured on the old Auto; picking again remeasures.)

### Sliders

Each runs from -100 to 100 in steps of 1, default 0. Double-tapping (double-clicking) a slider's label puts it back to 0.

- **Warmth:** red is multiplied by `1 + 0.2 * w / 100` and blue by `1 - 0.2 * w / 100`. Positive is warmer (more yellow-orange), negative cooler.
- **Tint:** green is multiplied by `1 - 0.2 * t / 100`. Positive is more magenta, negative more green.
- **Brightness:** `v ^ (2 ^ (-b / 100))`. Positive brightens the midtones and negative darkens them; black stays black and white stays white.
- **Contrast:** with `k = c / 100`: for `k > 0`, `v + k * (s(v) - v)` with `s(v) = v * v * (3 - 2 * v)`, an S-curve that deepens shadows and lifts highlights; for `k < 0`, `v + (-k) * (0.5 + (v - 0.5) / 2 - v)`, which flattens toward the middle (at -100, half the contrast). Both keep 0.5 where it is and never reverse the order of two values.
- **Saturation:** with luma `L = 0.2126 r + 0.7152 g + 0.0722 b` (on the corrected values), each channel becomes `L + (1 + s / 100) * (v - L)`. At -100 the photo is gray; at 100 its colors are twice as far from gray. Faded prints usually want a little more after Auto.

### Settings

Each photo has its own settings, kept in memory while it is open:

| Setting | Default |
|---|---|
| Auto | the **Auto on for new photos** preference (section 8) |
| Auto strength | 100% |
| White point | none |
| Warmth, Tint, Brightness, Contrast, Saturation | 0 |
| Rotation | 0 degrees |

- **Reset** puts the photo's settings back to these defaults, rotation included.
- **Apply to all** copies the current photo's Auto (on or off), Auto strength, Warmth, Tint, Brightness, Contrast and Saturation to every open photo. It does not copy the White point or the Rotation, which belong to one photo. Each photo keeps its own Auto statistics, so Auto still fits each one. (For a batch from one album, Auto plus the same slider settings is usually close.)
- There is no undo history; Reset and Clear are the way back. (Known limitations.)

## 5. Screen

- **Empty:** with no photo open, the screen shows the app's name, one line saying what it does and that photos stay on the device, and a large **Open photos** button. On a Chromebook it also says photos can be dropped or pasted.
- **Photo area:** the current photo's preview, corrected, fitted to the area without cropping, on a mid-gray background (so neither white nor black borders fool the eye).
- **Compare:** pressing and holding on the photo (or holding **Compare**, or the backslash key on a keyboard) shows the photo without corrections, rotation kept, until released. A short tap does nothing unless the eyedropper is armed.
- **Controls:** **Auto** (switch) with its **Strength** slider; **White point** and **Clear**; the five sliders; **Rotate left** and **Rotate right**; **Reset**; **Apply to all** (shown with two or more photos); **Save** and **Save all** (section 7). Every change shows in the preview at once; the preview is redrawn from the tables, so dragging a slider stays smooth.
- **Status line:** one line under the photo for what the eyedropper wants, errors (a file that couldn't be opened, a refused sample) and save results. A message stays until the next one or until the photo changes.
- **Several photos:** a strip of thumbnails shows every open photo in the order opened; tapping one makes it current. Each has a small × to close it (its work is lost; there is no confirmation, because nothing is lost from the original file). The current one is outlined.
- **Layout:** in a window at least 900 px wide (a Chromebook, an iPad in landscape), the controls sit in a panel to the right of the photo and the strip runs along the bottom. On a narrower screen (an iPhone), the photo is on top, the strip below it, and the controls in a panel below that, which scrolls on its own so the photo stays in view.
- **Keyboard** (Chromebook): Ctrl+O opens photos, Ctrl+S saves the current photo, left and right arrows move between photos, `[` and `]` rotate, `W` arms the eyedropper, Escape disarms it, backslash compares.
- **Preferences** (a ⚙ button) opens a dialog with the settings in section 8.

## 6. Rotation

- **Rotate left** and **Rotate right** turn the photo 90 degrees counterclockwise and clockwise. Four turns are back where it started (rotation is kept as 0, 90, 180 or 270 degrees).
- Rotation turns the preview, the white-point tap's mapping and the saved file. It does not change Auto's statistics (they don't depend on which way up the photo is).

Cropping is an open question (**Q6**).

## 7. Saving

- **Save** saves the current photo; **Save all** saves every open photo.
- **What is saved:** the original at full size (or scaled down as below), with its corrections and rotation, as a JPEG at the **JPEG quality** preference (default 92), in sRGB. The file name is the original's with its extension replaced by `-fixed.jpg` (`Grandma 1962.png` becomes `Grandma 1962-fixed.jpg`); a name with no extension just gets `-fixed.jpg`. The saved format is an open question (**Q4**).
- **Metadata:** the saved file has none (no EXIF: no date, no camera, no location). Keeping the original's date is an open question (**Q5**).
- **Where it goes:** the first of these that the browser can do (where Save puts files on a Chromebook is an open question, **Q8**):
  1. **The Save dialog** (Chrome on a Chromebook, through the File System Access API). **Save** opens the system's Save dialog with the file name filled in. It starts in the folder used last and offers every place the Files app knows, Google Drive included. **Save all** asks for a folder once and writes every photo into it. A name already in that folder is not overwritten: the photo is saved as `<name>-fixed (2).jpg`, then `(3)` and so on. (For **Save**, the dialog itself asks before replacing a file.) Cancelling the dialog saves nothing and says nothing.
  2. **The share sheet** (Safari on an iPhone). **Save** opens the share sheet with the file, which offers **Save Image** (to Photos), **Save to Files** (any folder in Files, Google Drive included when its app is installed), Messages and so on. **Save all** shares all the files in one share sheet.
  3. **A download**, into the Downloads folder (other browsers). **Save all** downloads the files one after another.
- **While saving:** the corrections are applied to the original in the Web Worker. Save and Save all show progress ("Saving 2 of 5"). The screen stays usable; settings changed during a save apply to the next save, not the one under way.
- **Too large for the device:** each browser limits how many pixels a canvas can hold (on an iPhone, 16,777,216, which is 4096 x 4096). A photo with more pixels than the limit is scaled down, keeping its proportions, to the largest whole size under it. The status line says so after saving ("Saved at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save"). Keeping the full size on such a device is an open question (**Q3**).
- **Errors:** if saving fails, the status line says which file failed; the others still save.
- The open photos and their settings are kept after saving.

## 8. Preferences

Kept in localStorage as one JSON object under `photo-fix.prefs`. A missing, unreadable or out-of-range value falls back to its default, field by field, and an unknown field is ignored.

| Preference | Values | Default |
|---|---|---|
| Auto on for new photos | on, off | on |
| JPEG quality | 60 to 100, whole numbers | 92 |

- A change applies at once: the JPEG quality to the next save, Auto on for new photos to the next photo opened (not to photos already open).
- The photos, their settings and the open list are never stored. Closing or reloading the page closes every photo (Known limitations).
- Nothing is sent anywhere: once the app has loaded, it makes no network requests except to its own site, to update itself. The Content Security Policy (section 2, **Security**) blocks any other.

## 9. Open questions

Every question has a permanent number, Q1, Q2 and so on, given in the order the questions were opened. A number never changes and is never reused, so it means the same question here, in **Resolved questions** (section 11), in the app, and in pull requests and commits. The next new question is **Q9**.

Each question's first option is what the first version builds; the others are not built unless the question is decided their way (or the question asks for both to be tried).

### Q1. Should Auto also even out the midtones?

Per-channel levels (section 4, **Auto**) set each channel's black and white points, but a print whose dyes faded unevenly in the middle can keep a cast in the midtones.

| Option | Behavior |
|---|---|
| Levels only | As in section 4 |
| Levels and midtones | After the stretch, each channel also gets a power curve `v ^ gamma` that moves its median (over the same measured pixels) to the mean of the three channels' medians: `gamma = ln(target) / ln(median)`, clamped to 0.5 to 2; a channel with its median at 0 or 1 is left alone |
| Both, as a choice | Auto has a **Midtones** switch, off by default |

### Q3. What happens to a photo too large for the device to save?

See section 7, **Too large for the device**. A 600 dpi scan of a 4 x 6 print is about 8.6 million pixels and fits; an 8 x 10 at 600 dpi (28.8 million) or a 4 x 6 at 1200 dpi (34.6 million) doesn't, on an iPhone.

| Option | Behavior |
|---|---|
| Scale it down | As in section 7, with the message |
| Keep the full size | The worker corrects the photo in strips of rows and encodes the JPEG itself with a JavaScript encoder, so no canvas holds the whole photo. Slower, and decoding a very large photo can still fail on an iPhone |

### Q4. What format are photos saved in?

| Option | Behavior |
|---|---|
| Always JPEG | As in section 7 |
| Same as the original | A PNG is saved as PNG (larger, lossless), a JPEG or WebP as JPEG |
| A preference | **Save as**: JPEG or PNG |

### Q5. Should the saved file keep the original's date?

Scanned files rarely carry a useful date, but a photo from the iPhone's library (a scan made with the camera, say) does, and Photos sorts by it.

| Option | Behavior |
|---|---|
| No metadata | As in section 7 |
| Copy the date | The original's EXIF date taken (and only that) is written into the saved JPEG |

### Q6. Should Photo Fix crop?

Scanning often leaves scanner bed around the print, and several prints are often scanned at once.

| Option | Behavior |
|---|---|
| No cropping | Crop in another app |
| Manual crop | A crop tool with handles, applied to the preview, the analysis and the save |
| Find the prints | The app finds each print on a scan of several and opens each one as its own photo, straightened |

### Q8. Where does Save put files on a Chromebook?

Both devices can open photos from Google Drive already (section 3: the iPhone's Files app lists Drive once the Google Drive app is installed; the Chromebook's Files app lists it). Saving is where they differ.

| Option | Behavior |
|---|---|
| The Save dialog | As in section 7: **Save** asks where to put the file, Google Drive included, and **Save all** asks for a folder once |
| Downloads | Chrome downloads to the Downloads folder, one file at a time for **Save all**; moving them to Drive is left to the Files app (or Chrome's **Ask where to save each file** setting) |
| A Google Drive connection | A Google sign-in and Drive's own file browser inside the app, on both devices. Needs a Google Cloud project, and network requests to Google, which the Content Security Policy (section 2) would have to allow, ending the promise that the app contacts only its own site |

Still to think about: dust and scratch removal; restoring a black-and-white photo's neutral tone (or a sepia one's); a histogram display; undo.

## 10. Publishing

- **Checks:** `.github/workflows/deploy.yml` runs the typecheck, the linter and the unit tests on every push to any branch, so a failure shows before a pull request is opened, and on every pull request, including one from a fork. Nothing is published unless they pass.
- **Publishing:** after the checks pass on `main` or on a pull request from this repository, it builds and publishes to GitHub Pages from the `gh-pages` branch. A push to another branch is checked but not published.
- **`main`** is the live app: `https://dblevins-3dgfx.github.io/photo-fix/`.
- **Each pull request** from this repository gets a preview at `https://dblevins-3dgfx.github.io/photo-fix/pr-preview/pr-<number>/`, linked from one comment on the pull request that is kept up to date. The link changes with each push (`?v=<commit>`) so it always opens the newest build. Each push rebuilds the preview; closing or merging the pull request removes it. A pull request from a fork gets the checks but no preview.
- **A preview build** shows a small **Preview #<number>** badge linking to the pull request, and keeps its own preferences under `photo-fix.preview.<number>.prefs`, copied once from the live app's the first time it opens, so trying a change never alters the live app's preferences. Its service worker is scoped to its own folder.
- The first preview run on a `gh-pages` branch with no live app yet also builds `main` into the root, so the live site never goes blank.
- Every file the published `index.html` names must exist, or the run fails.
- One-time setup: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

## 11. Resolved questions

Open questions that have been decided, oldest first, under their permanent numbers. The decision itself then lives in the section it belongs to, and the options that lost are removed from the app, the code and the tests. Reasons are recorded where they were given.

| Q | Date | Question | Options tried | Decision | What changed | PR |
|---|---|---|---|---|---|---|
| Q7 | 2026-11-07 | How does Save all deliver several files on a Chromebook? | One download each; one zip file | **Replaced by Q8** | Neither was built. The question became Q8 (where Save puts files on a Chromebook), whose default, Chrome's Save dialog, writes Save all into one chosen folder, so a zip isn't needed. Reason: photos are kept in Google Drive, and the Save dialog can save straight into it | [#1](https://github.com/dblevins-3dgfx/photo-fix/pull/1) |
| Q2 | 2026-11-07 | Should TIFF files open? | No; Yes, with a TIFF decoder library | **No** | TIFF is skipped with the unsupported-format message, which suggests JPEG or PNG (section 3, **Formats**). No decoder library was added. JPEG, PNG and WebP still open, since the browser decodes them all the same way at no extra cost. Reason: the scanner in use saves only JPEG | [#1](https://github.com/dblevins-3dgfx/photo-fix/pull/1) |

## 12. Known limitations

- No undo history: Reset and Clear are the only way back.
- Nothing is kept between visits: closing or reloading the page closes every photo and loses its settings. The original files are never changed.
- 8 bits per channel throughout (section 3, **Bit depth**).
- The saved JPEG carries no color profile; it is in sRGB, which is what every phone, browser and photo app assumes.
- No dust, scratch or tear repair, no sharpening and no noise reduction.
