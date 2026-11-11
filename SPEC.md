# Photo Fix: Specification

Status: the first version. This describes the app as implemented: the screen in `src/App.tsx` and `src/ui/` (the photo area in `PhotoView.tsx`, the controls in `Controls.tsx`, the strip in `Strip.tsx`, the Preferences dialog in `Preferences.tsx`), with what it does in the hooks in `src/hooks/` (opening photos in `useOpenPhotos.ts`, saving in `useSaving.ts`, the status line in `useStatus.ts`, the eyedropper in `useEyedropper.ts`, keyboard shortcuts in `useShortcut.ts`), decoding a photo in `src/photo.ts`, the places a save can go in `src/save.ts` and the part in view when zoomed in in `src/detail.ts`, with the full-size work for both done by the Web Worker (`src/worker.ts`, reached through `src/worker-client.ts`) as the jobs in `src/jobs/` (`save-job.ts`, `region-job.ts`), the preferences in localStorage in `src/storage.ts`, and the service worker in `src/service-worker.js`. The rules live in plain, unit-tested functions in `src/lib/`: the settings in `settings.ts`, with the table of adjustments (each switch and slider, its range, its default and whether Apply to all copies it) in `adjustments.ts`, built from the fields in `fields.ts`, the open photos and what the controls do to them in `photos.ts`, Auto's statistics in `levels.ts`, the corrections in `correction.ts`, the White point in `white-point.ts`, rotation in `rotation.ts`, zoom and pan in `view.ts`, what a touch means (tap, double-tap, hold, drag, pinch) in `gesture.ts` and what it does to the view in `view-gestures.ts`, sizes and the device's limit in `sizes.ts`, file names in `filename.ts`, where a save goes in `save-method.ts`, the save loop in `save-photos.ts`, the keyboard in `keyboard.ts`, the status line's words in `messages.ts`, the preferences and their table in `prefs.ts`, the Content Security Policy in `csp.ts` and what the service worker caches in `precache.ts`. Decisions still to be made are listed under [Open questions](#9-open-questions), each with the option the first version builds. Decided questions go under [Resolved questions](#11-resolved-questions).

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
| Checks | `npm run typecheck` (tsc), `npm run lint` (oxlint, warnings are errors), `npm test`. The linter also limits each function's cyclomatic complexity to 15 (`.oxlintrc.json`): a function at 16 or more fails it |
| Persistence | Preferences only, in localStorage under keys starting `photo-fix.` (section 8). Photos are never stored |
| Home screen | Installable: `public/manifest.webmanifest` names it Photo Fix and opens it full screen (`standalone`), with 192 and 512 px icons; `index.html` adds Apple's tags (180 x 180 `apple-touch-icon.png`, full-screen capable, the title, status bar style). On an iPhone: Safari, Share, Add to Home Screen. Opened from the home screen it keeps its own storage, separate from Safari's |
| Offline | A service worker (`sw.js`, beside the page, so a preview's covers only its own folder) caches every published file on the first visit; the build writes the list into it. Later visits open without the network: the page and every other file come from the cache, so a page and the files it loads later (the background worker's script, on the first save or zoom) are always one version. A new version is found on a visit after it is published and downloaded beside the old one, but it doesn't take over a page that is open: it waits until every window of the old version has closed (on an iPhone, the home-screen app closed from the app switcher, not just sent to the background), and the launch after that is the new version. Its old version's cache is deleted then. The live app and every preview share one site, and so one set of caches: each build's cache is named after its folder and version, and a build only ever deletes its own folder's older caches, never the live app's or another preview's. A service worker also leaves alone a visit to a folder inside its own (a preview's, seen by the live app's), neither answering it nor caching it |
| Touch | The page reaches under the notch and home bar (`viewport-fit=cover`) and pads itself back in by the safe-area insets. Double-tap zoom, text selection, the long-press callout and the tap highlight are turned off for the whole page, and the photo area takes every touch itself (`touch-action: none`), so a pinch or a drag there never scrolls or zooms the page |
| Security | A Content Security Policy in a `<meta>` tag in the built `index.html` (GitHub Pages can't send it as a header) lets the page load and contact nothing but its own site, so the browser itself enforces that photos never leave the device (section 8). The policy is `contentSecurityPolicy()` in `src/lib/csp.ts`, added by the build: `default-src 'self'`; `script-src 'self'` (no inline scripts, no `eval`); `style-src 'self' 'unsafe-inline'` (React writes style attributes, such as a slider's position); `img-src 'self' blob: data:` (previews and thumbnails are drawn from blobs); `worker-src 'self'` (the Web Worker and the service worker); `connect-src 'self'`; `manifest-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'none'`. The build fails if the built `index.html` has an inline script, which the policy would block. The dev server (`npm run dev`) runs without it, since Vite's hot reload uses inline scripts |
| Light and dark | The controls follow the device's light or dark setting (`prefers-color-scheme`) and switch at once when it changes; nothing is stored. The photo area is the same mid-gray (sRGB 128, 128, 128) in both, so the backdrop never changes how a photo's colors look. The theme color (the iPhone's status bar, Chrome's title bar) follows too |
| Publishing | GitHub Pages, from the `gh-pages` branch, by `.github/workflows/deploy.yml` (section 10), on Node.js 22 |
| Dependency updates | Dependabot, weekly, for the GitHub Actions the workflow uses |

## 3. Opening photos

- **Open photos** (a button, on the empty screen and in the toolbar) opens the system file picker, which accepts several files at once. On an iPhone it offers the photo library, Files and the camera; on a Chromebook, the Files app. Google Drive is reachable from both: the iPhone's Files app lists it once the Google Drive app is installed and turned on as a location, and the Chromebook's Files app lists it beside Downloads. The app itself never talks to Google; the system's picker does.
- On a Chromebook, photos can also be dropped onto the window, or pasted (Ctrl+V) from the clipboard.
- **Formats:** JPEG, PNG and WebP. An iPhone's HEIC photos arrive as JPEG through the photo picker. A file the browser can't decode (HEIC from Files on a Chromebook, TIFF, RAW) is skipped with a message naming the file, saying the format isn't supported, and suggesting JPEG or PNG instead. TIFF isn't supported (Resolved questions, **Q2**).
- **Orientation:** a photo's EXIF orientation is applied when it is decoded, so it shows the way up the camera or scanner meant.
- **Color profiles:** the browser converts a photo with an embedded color profile (Adobe RGB, for example) to sRGB when it decodes it. All the correction works in sRGB.
- **Bit depth:** the browser decodes every photo to 8 bits per channel, so a 16-bit PNG is corrected and saved at 8 bits.
- Opening more photos adds them to the ones already open, after them. Each photo is listed by its file name (a pasted photo with no name is called `Pasted photo.png`). With none open, the first one opened becomes current.
- When a photo is opened, its settings start at the defaults (section 4, **Settings**), with **Auto** on or off according to the **Auto on for new photos** preference (section 8).

### Sizes

- Each open photo keeps three sizes: the **original** at full size (kept as the file it came from, and decoded again when saving, so a dozen open scans don't fill an iPhone's memory), the **analysis image**, the photo scaled so its longer side is at most 1024 px (never scaled up), and the **preview**, with its longer side the screen's longer side at the screen's pixel density, at most 2048 px (so it is sharp at Fit however the photo is turned or the window sized). Zoomed in past the preview, the part in view is also redrawn from the original (section 5, **Zoom and pan**, Sharpness).
- A thumbnail for the strip (section 5), at most 160 px on the longer side and without corrections, is made at the same time.
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

Per-channel levels: stretches each of red, green and blue so its darkest and lightest values reach black and white. This removes most color casts from faded prints, because each dye faded by a different amount. **Midtones** goes further, for a print whose dyes faded unevenly in the middle as well (Resolved questions, **Q1**).

- **Where it measures:** a histogram of each channel over the analysis image, leaving out a margin of 2% of the width at the left and right and 2% of the height at the top and bottom (rounded down to whole pixels), so the scanner lid or bed around the print doesn't count.
- **Black and white points:** for each channel, `lo` is the lowest value with at least 0.5% of the measured pixels at or below it, and `hi` is the highest value with at least 0.5% of the measured pixels at or above it. Both are found on the 0 to 255 histogram and then divided by 255.
- **Flat channels are left alone:** a channel with `hi - lo` below 0.1 (a photo that is nearly one color, or blank) is not stretched.
- **Stretch:** otherwise, `auto(v) = (v - lo) / (hi - lo)`, clamped to 0 to 1.
- **Midtones:** a switch, off by default, shown only while Auto is on. On, each channel also gets a power curve after its stretch, `v ^ gamma`, that moves its median to the mean of the three channels' medians, so a cast left in the middle tones goes too. The **median** of a channel is the lowest value with at least half of the measured pixels (the same pixels as `lo` and `hi`) at or below it, found on the 0 to 255 histogram, divided by 255, then stretched like any other value. With the stretched medians `m` and their mean `target`, `gamma = ln(target) / ln(m)`, clamped to 0.5 to 2. A channel whose stretched median is 0 or 1 is left alone, and so is every channel when `target` is 0 or 1.
- **Strength:** a slider from 0% to 100%, default 100%, blends between the photo and the stretch (with Midtones, the stretch and its curve): `v + strength * (auto(v) - v)`. At 0% Auto changes nothing. The slider is shown only while Auto is on.
- **On and off:** Auto is a switch. Turning it off keeps the strength and Midtones, so turning it on again restores them.
- The statistics (`lo`, `hi` and the median per channel) are measured once, when the photo is opened. They don't depend on any setting.

### White point

The eyedropper: tap (or click) something in the photo that should be neutral, such as a white border, a gray sky or a white shirt, and the photo's colors are balanced so it is.

- **White point** is a button that arms the eyedropper. While it is armed, the status line says "Tap something that should be white or gray". The next tap on the photo samples it; tapping the button again or pressing Escape disarms it without sampling.
- **Sample:** the average of each channel over a 5 x 5 block of the analysis image centered on the tapped point (clipped at the photo's edges), after Auto (step 1) has been applied. The point is mapped from the screen to the analysis image through the current rotation.
- **Too dark:** if any channel of the sample is below 0.04, the tap is refused, the eyedropper stays armed, and the status line says "Too dark to judge. Pick something lighter".
- **Gains:** with the sample's channels `r`, `g`, `b` and their mean `m = (r + g + b) / 3`, each channel is multiplied by `m / r`, `m / g` and `m / b`. That makes the sample gray without changing its brightness. Each gain is clamped to 0.5 to 2.
- The gains are kept, not the point, so the White point stays when other settings change. A new sample replaces the old one. **Clear** (beside the button, shown only while a white point is set) removes it.
- Changing Auto (on, off or strength) after a white point was picked keeps the gains as they are. (They were measured on the old Auto; picking again remeasures.)

### Sliders

Each runs from -100 to 100 in steps of 1, default 0. Double-tapping (double-clicking) a slider's label, two taps within 400 ms, puts it back to its default: 0 for these five, and 100% for Auto's **Strength**.

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
| Midtones | off |
| White point | none |
| Warmth, Tint, Brightness, Contrast, Saturation | 0 |
| Rotation | 0 degrees |

- **Reset** puts the photo's settings back to these defaults, rotation included.
- **Apply to all** copies the current photo's Auto (on or off), Auto strength, Midtones, Warmth, Tint, Brightness, Contrast and Saturation to every open photo. It does not copy the White point or the Rotation, which belong to one photo. Each photo keeps its own Auto statistics, so Auto still fits each one. (For a batch from one album, Auto plus the same slider settings is usually close.)
- There is no undo history; Reset and Clear are the way back. (Known limitations.)

## 5. Screen

- **Empty:** with no photo open, the screen shows the app's name, one line saying what it does and that photos stay on the device, and a large **Open photos** button. On a Chromebook it also says photos can be dropped or pasted.
- **Photo area:** the current photo, corrected, on a mid-gray background (so neither white nor black borders fool the eye). It starts fitted to the area without cropping (**Fit**), with an 8 px margin, and can be zoomed and panned (**Zoom and pan**, below).
- **Compare:** pressing and holding still on the photo for a third of a second (or holding **Compare**, or the backslash key on a keyboard) shows the photo without corrections, rotation and zoom kept, until the last of the three is released (letting go of the button while backslash is still down keeps comparing). Compare also ends when the window loses focus or the page is hidden, since a key let go of elsewhere never comes back. A finger that moves more than 8 px first is a drag, not a hold. A short tap samples when the eyedropper is armed; otherwise a double-tap zooms (below). Changing photos disarms the eyedropper.
- **Controls**, from the top: **Save**, and **Save all** with two or more photos open (section 7); **Auto** (switch), with its **Strength** slider and **Midtones** switch while it is on; **White point**, and **Clear** while one is set; the five sliders; **Left** and **Right** (rotate, section 6) and **Compare**; **Reset**, and **Apply to all** with two or more photos open. Every change shows in the preview at once; the preview is redrawn from the tables, so dragging a slider stays smooth.
- **Status line:** a line under the photo for what the eyedropper wants, errors (a file that couldn't be opened, a refused sample), save progress and save results. A message stays until the next one or until the photo changes. A long message wraps onto as many lines as it needs, so none of it is cut off; on a narrow screen the strip and the controls move down to make room. Files that couldn't be opened are named together ("2 files couldn't be opened (a.tif, b.heic): their format isn't supported. Try JPEG or PNG instead."); with no photo open, the message shows under **Open photos**.
- **Header:** the app's name, **Open photos** (once a photo is open) and **Preferences** (⚙). A preview build adds its badge (section 10).
- **Several photos:** a strip of thumbnails shows every open photo in the order opened; tapping one makes it current. Each has a small × to close it (its work is lost; there is no confirmation, because nothing is lost from the original file). The current one is outlined.
- **Layout:** in a window at least 900 px wide (a Chromebook, an iPad in landscape), the controls sit in a panel to the right of the photo and the strip runs along the bottom. On a narrower screen (an iPhone), the photo is on top, the strip below it, and the controls in a panel below that, which scrolls on its own so the photo stays in view.
- **Keyboard** (Chromebook): Ctrl+O opens photos, Ctrl+S saves the current photo, left and right arrows move between photos, `[` and `]` rotate, `W` arms the eyedropper (and disarms it), Escape disarms it, backslash compares, `+` (or `=`) and `-` zoom in and out by 2x toward the middle, and `0` fits. While a slider or another control has the focus, only Ctrl+O, Ctrl+S and Escape are shortcuts, so the arrows move the slider. While the Preferences dialog is open, no key is a shortcut: Ctrl+O and Ctrl+S do nothing, and Escape only closes the dialog.
- **Preferences** (a ⚙ button) opens a dialog with the settings in section 8. **Done**, Escape or a tap outside it closes it. While it is open, the keyboard shortcuts are off (**Keyboard**, above).

### Zoom and pan

Zooming in shows detail, and makes the White point easier to place with a finger.

- **Zoom** runs from **Fit** (1) up to 4x Fit or twice **100%**, whichever is more. **100%** shows one pixel of the photo on one pixel of the screen; for a photo smaller than the area it is the same as Fit. Zoomed in, the photo always covers the area: it can't be panned past its edge. Smaller than the area (at Fit), it stays centered.
- **Presets:** buttons at the bottom right of the photo area: **Fit**, **100%**, **2x** and **4x**. Each zooms toward the middle of the area, and the one matching the zoom is highlighted.
- **Touch:**
  - pinch with two fingers to zoom, around the point between them, and move them together to pan;
  - drag with one finger to pan, when zoomed in. The photo moves with the finger from the point where it has moved more than 8 px;
  - double-tap (a second tap within 300 ms of the first) to zoom to 2x around the tapped point, or, zoomed in, back to Fit. While the eyedropper is armed, a tap samples instead, and doesn't count toward a double-tap;
  - a pinch is never a tap or a hold: a second finger ends a hold, and the finger left on the screen after a pinch does nothing until it lifts too;
  - a hold (**Compare**, above) that has begun carries on if the finger then moves, without panning.
- **Mouse and trackpad** (Chromebook): Ctrl + scroll wheel, or a trackpad pinch, zooms toward the pointer; scrolling pans; dragging pans when zoomed in. The keyboard's `+`, `-` and `0` are above.
- **Overview:** zoomed in, a small picture of the whole photo (at most 96 px) at the top left shows a white frame round the part in view.
- **Sharpness:** the preview is at most 2048 px, so zoomed in past it, the part in view would be soft. Once the view has stayed still for a fifth of a second, that part is redrawn from the original, at the screen pixels it covers (never more than the original has), and drawn over the preview. It is corrected the same way as the preview (rule: **Same correction everywhere**), so a change to a setting shows at once, and Compare shows it uncorrected. Until it arrives, and if the original can't be decoded, the preview shows, softer. The Web Worker keeps the decoded original of the photo last zoomed into, so panning doesn't decode it again.
- Zoom and pan go back to Fit when another photo becomes current and when the photo is turned. They are never stored, and they don't change what is saved.
- The White point's tap is mapped through the zoom and pan, then the rotation, to the analysis image. A tap off the photo (in the margin) samples nothing. Whether to sample a finer spot when zoomed in is an open question (**Q10**).

## 6. Rotation

- **Rotate left** and **Rotate right** turn the photo 90 degrees counterclockwise and clockwise. Four turns are back where it started (rotation is kept as 0, 90, 180 or 270 degrees).
- Rotation turns the preview, the overview, the white-point tap's mapping and the saved file. It does not change Auto's statistics (they don't depend on which way up the photo is).

Cropping is an open question (**Q6**).

## 7. Saving

- **Save** saves the current photo; **Save all** saves every open photo.
- **What is saved:** the original at full size (or scaled down as below), with its corrections and rotation, as a JPEG at the **JPEG quality** preference (default 92), in sRGB. The saved format is an open question (**Q4**).
- **File name:** the original's name without its extension (a name with no extension is used whole), then:
  - a name that doesn't end in `-fixed` or `-fixed (n)` gets `-fixed.jpg`: `Grandma 1962.png` becomes `Grandma 1962-fixed.jpg`;
  - a name ending in `-fixed` (a photo fixed before) becomes `-fixed (2).jpg`: `Grandma 1962-fixed.jpg` becomes `Grandma 1962-fixed (2).jpg`;
  - a name ending in `-fixed (n)` becomes `-fixed (n+1).jpg`: `Grandma 1962-fixed (2).jpg` becomes `Grandma 1962-fixed (3).jpg`.

  So `-fixed` is never added twice. The ending is matched ignoring case, and the rest of the name is kept as it was. Fixing a fixed photo works, but every JPEG save loses a little quality, so fixing the original again (it never changes) gives the better result. Whether the saved photo remembers how it was fixed is an open question (**Q9**).
- **Metadata:** the saved file has none (no EXIF: no date, no camera, no location). Keeping the original's date is an open question (**Q5**).
- **Where it goes:** the first of these that the browser can do (where Save puts files on a Chromebook is an open question, **Q8**):
  1. **The Save dialog** (Chrome on a Chromebook, through the File System Access API). **Save** opens the system's Save dialog with the file name filled in. It starts in the folder used last and offers every place the Files app knows, Google Drive included. **Save all** asks for a folder once and writes every photo into it. A name already in that folder is not overwritten: the number goes up until the name is free (`-fixed.jpg` taken, so `-fixed (2).jpg`; `-fixed (2).jpg` taken, so `-fixed (3).jpg`), the same numbering as the file name rule above. (For **Save**, the dialog itself asks before replacing a file.) Cancelling the dialog saves nothing and says nothing.
  2. **The share sheet** (Safari on an iPhone). **Save** opens the share sheet with the file. Where the photo goes is the sheet's choice: **Save Image** puts it in the Photos app (at the end of Recents), **Save to Files** in the folder chosen there (Google Drive included, once the Google Drive app is installed and turned on in Files), the **Drive** app uploads it to Google Drive, and Messages, Mail and so on send it. **Save all** shares all the files in one share sheet. Safari opens the share sheet only soon after a tap, and making the files can take longer; when Safari refuses, the status line says "Ready to save. Tap Share" (or "3 photos ready to save. Tap Share") with a **Share** button, which opens it. Closing the share sheet without choosing saves nothing and says nothing, unless a photo failed before it: that failure is still reported (**Errors**, below).
  3. **A download**, into the Downloads folder (other browsers). **Save all** downloads the files one after another. A page can't tell whether a download finished, so the status line says the file was downloaded, never that it was saved.
- **Names in one Save all:** no two files of one Save all get the same name, whichever way they are delivered. When two open photos would get the same name (`a.png` and `a.jpg`, or two scans both called `scan.jpg`), the later one gets the next number, by the file name rule above: `a-fixed.jpg`, then `a-fixed (2).jpg`. A photo that fails doesn't use up a name.
- **While saving:** the corrections are applied to the original in the Web Worker. Save and Save all show progress ("Saving 2 of 5"). The screen stays usable; settings changed during a save apply to the next save, not the one under way. Until the save is done, **Save** and **Save all** are greyed out and Ctrl+S does nothing, so one save at a time runs.
- **Too large for the device:** each browser limits how many pixels a canvas can hold (on an iPhone, 16,777,216, which is 4096 x 4096). A photo with more pixels than the limit is scaled down, keeping its proportions, to the largest whole size under it. The status line says so after saving ("Shared at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save" on an iPhone; see **When it's done**). Keeping the full size on such a device is an open question (**Q3**).
- **When it's done:** the status line names the file, or for Save all says how many, with a word that says only what Photo Fix knows:
  - the Save dialog: "Saved Grandma 1962-fixed.jpg", "Saved 5 photos";
  - the share sheet: "Shared Grandma 1962-fixed.jpg", "Shared 5 photos" (Photo Fix can't tell whether the sheet put it in Photos, in Files or in a message);
  - a download: "Downloaded Grandma 1962-fixed.jpg. Look in your Downloads folder", "Downloaded 5 photos. Look in your Downloads folder".

  A photo saved smaller than its scan says so with the same word ("Shared at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save"); for Save all, the line adds how many are smaller than their scans ("Saved 5 photos. 2 are smaller than their scans, the most this device can save").
- **Errors:** if saving fails, the status line says which file failed ("Couldn't save Grandma 1962-fixed.jpg"), ahead of what was saved; the others still save. A photo also fails if the Web Worker stops before it is done (the browser can stop it for using too much memory, or it can fail to load), or if it takes longer than 3 minutes; the next photo starts a fresh worker. So a save always ends, and Save and Save all come back.
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

Every question has a permanent number, Q1, Q2 and so on, given in the order the questions were opened. A number never changes and is never reused, so it means the same question here, in **Resolved questions** (section 11), in the app, and in pull requests and commits. The next new question is **Q11**.

Each question's first option is what the first version builds; the others are not built unless the question is decided their way (or the question asks for both to be tried). A question's **Depends on** note names the refactor issue that should land first, to make its other options smaller changes. Each question also has an issue of its own, linked under its heading, for discussing it.

### Q3. What happens to a photo too large for the device to save?

Issue: [#13](https://github.com/dblevins-3dgfx/photo-fix/issues/13)

See section 7, **Too large for the device**. A 600 dpi scan of a 4 x 6 print is about 8.6 million pixels and fits; an 8 x 10 at 600 dpi (28.8 million) or a 4 x 6 at 1200 dpi (34.6 million) doesn't, on an iPhone.

| Option | Behavior |
|---|---|
| Scale it down | As in section 7, with the message |
| Keep the full size | The worker corrects the photo in strips of rows and encodes the JPEG itself with a JavaScript encoder, so no canvas holds the whole photo. Slower, and decoding a very large photo can still fail on an iPhone |

**Depends on:** [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10). Keeping the full size replaces the save job's render and encode steps with versions that work in strips of rows.

### Q4. What format are photos saved in?

Issue: [#14](https://github.com/dblevins-3dgfx/photo-fix/issues/14)

| Option | Behavior |
|---|---|
| Always JPEG | As in section 7 |
| Same as the original | A PNG is saved as PNG (larger, lossless), a JPEG or WebP as JPEG |
| A preference | **Save as**: JPEG or PNG |

**Depends on:** [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10). Another format changes only the save job's encode step (and the file name's extension). As a preference, it also depends on [#11](https://github.com/dblevins-3dgfx/photo-fix/issues/11), where a preference is one entry in the table of preferences.

### Q5. Should the saved file keep the original's date?

Issue: [#15](https://github.com/dblevins-3dgfx/photo-fix/issues/15)

Scanned files rarely carry a useful date, but a photo from the iPhone's library (a scan made with the camera, say) does, and Photos sorts by it.

| Option | Behavior |
|---|---|
| No metadata | As in section 7 |
| Copy the date | The original's EXIF date taken (and only that) is written into the saved JPEG |

**Depends on:** [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10). Copying the date is a metadata step in the save job, with the EXIF reading and writing in a plain, tested module.

### Q6. Should Photo Fix crop?

Issue: [#16](https://github.com/dblevins-3dgfx/photo-fix/issues/16)

Scanning often leaves scanner bed around the print, and several prints are often scanned at once.

| Option | Behavior |
|---|---|
| No cropping | Crop in another app |
| Manual crop | A crop tool with handles, applied to the preview, the analysis and the save |
| Find the prints | The app finds each print on a scan of several and opens each one as its own photo, straightened |

**Depends on:** [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10), in part. A crop is a new per-photo setting (the test helpers keep that to one place) and brings its own shortcuts (`useShortcut`). It also changes where Auto measures, drawing, the tap mapping, zoom and saving, whatever the architecture.

### Q8. Where does Save put files on a Chromebook?

Issue: [#17](https://github.com/dblevins-3dgfx/photo-fix/issues/17)

Both devices can open photos from Google Drive already (section 3: the iPhone's Files app lists Drive once the Google Drive app is installed; the Chromebook's Files app lists it). Saving is where they differ.

| Option | Behavior |
|---|---|
| The Save dialog | As in section 7: **Save** asks where to put the file, Google Drive included, and **Save all** asks for a folder once |
| Downloads | Chrome downloads to the Downloads folder, one file at a time for **Save all**; moving them to Drive is left to the Files app (or Chrome's **Ask where to save each file** setting) |
| A Google Drive connection | A Google sign-in and Drive's own file browser inside the app, on both devices. Needs a Google Cloud project, and network requests to Google, which the Content Security Policy (section 2) would have to allow, ending the promise that the app contacts only its own site |

**Depends on:** nothing, while the Save dialog stays. A Google Drive connection would be a large change of its own, outside both refactors.

### Q9. Should the saved photo remember how it was fixed?

Issue: [#18](https://github.com/dblevins-3dgfx/photo-fix/issues/18)

A JPEG holds one picture and no revision history, so once saved, the settings that made it are gone. Photo apps (Apple Photos, Lightroom) keep the original and the edit's settings instead, and recompute the result.

| Option | Behavior |
|---|---|
| No | As in section 7: the saved file has no metadata |
| Settings in the JPEG | The saved JPEG carries, in its XMP metadata (a few hundred bytes, ignored by other apps), the correction settings (section 4, **Settings**, with Auto's statistics and the White point's gains) and the original's file name. Opening a `-fixed` photo shows how it was made; with the original open too, **Start over from the original** opens the original with those settings applied, so it can be adjusted and saved again without a second JPEG loss |
| A sidecar file | The same settings in a small file saved beside the photo (`<name>-fixed.photofix.json`). Works with any format, but it's a second file to keep with every photo, and the share sheet on an iPhone would save it to Files, not to Photos |

**Depends on:** [#11](https://github.com/dblevins-3dgfx/photo-fix/issues/11) most: the table of adjustments says which settings to write, and how to check each when reading them back. Also [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10): writing them is a metadata step in the save job, and **Start over from the original** lives with opening photos (`useOpenPhotos`).

### Q10. When zoomed in, where does the White point sample?

Issue: [#19](https://github.com/dblevins-3dgfx/photo-fix/issues/19)

Zoomed in (section 5, **Zoom and pan**), a tap lands far more precisely than the 5 x 5 block of the 1024 px analysis image it samples (section 4, **White point**): on a 600 dpi scan of a 6 x 4 print, that block covers about 18 pixels of the original each way, about 1/35 of an inch, whatever the zoom.

| Option | Behavior |
|---|---|
| The analysis image | As in section 4: a 5 x 5 block of the analysis image, at any zoom |
| The original | A 5 x 5 block of the original at full size, after Auto. As fine as the tap, but so small it can land on film grain or a speck of dust |
| A fingertip on the screen | A block of the original covering about 10 x 10 CSS pixels of the screen round the tap, after Auto: about the analysis image's block at Fit, and a smaller, more precise spot the further you zoom in |

The other two options take the sample from the original, not the analysis image, which changes the rule in section 3 (**Sizes**) that the sample always comes from the analysis image.

**Depends on:** [#10](https://github.com/dblevins-3dgfx/photo-fix/issues/10). Sampling the original is a new worker job, and sampling moves out of `App.tsx` along with it.

Still to think about: dust and scratch removal; restoring a black-and-white photo's neutral tone (or a sepia one's); a histogram display; undo.

## 10. Publishing

- **Checks:** `.github/workflows/deploy.yml` runs the typecheck, the linter (with its complexity limit, section 2) and the unit tests on every push to any branch, so a failure shows before a pull request is opened, and on every pull request, including one from a fork. Nothing is published unless they pass.
- **Complexity report:** each run's summary on GitHub lists the ten most complex functions outside the tests, with the limit, and marks any at 16 or more. It is written even when the linter fails, so a pull request shows how close it comes.
- **Publishing:** after the checks pass on `main` or on a pull request from this repository, it builds and publishes to GitHub Pages from the `gh-pages` branch. A push to another branch is checked but not published.
- **`main`** is the live app: `https://dblevins-3dgfx.github.io/photo-fix/`.
- **Each pull request** from this repository gets a preview at `https://dblevins-3dgfx.github.io/photo-fix/pr-preview/pr-<number>/`, linked from one comment on the pull request that is kept up to date. The link changes with each push (`?v=<commit>`) so it always opens the newest build. Each push rebuilds the preview; closing or merging the pull request removes it. A pull request from a fork gets the checks but no preview.
- **A preview build** shows a small **Preview #<number>** badge linking to the pull request, and keeps its own preferences under `photo-fix.preview.<number>.prefs`, copied once from the live app's the first time it opens, so trying a change never alters the live app's preferences. Its service worker is scoped to its own folder, and its cache is its own: opening a preview never removes the live app's offline copy, and the reverse (section 2, **Offline**).
- The first preview run on a `gh-pages` branch with no live app yet also builds `main` into the root, so the live site never goes blank. (Until `main` has an app, there is nothing to build, and the root stays empty.)
- Every file the published `index.html` names must exist, or the run fails.
- One-time setup: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

## 11. Resolved questions

Open questions that have been decided, oldest first, under their permanent numbers. The decision itself then lives in the section it belongs to, and the options that lost are removed from the app, the code and the tests. Reasons are recorded where they were given.

| Q | Date | Question | Options tried | Decision | What changed | PR |
|---|---|---|---|---|---|---|
| Q7 | 2026-11-07 | How does Save all deliver several files on a Chromebook? | One download each; one zip file | **Replaced by Q8** | Neither was built. The question became Q8 (where Save puts files on a Chromebook), whose default, Chrome's Save dialog, writes Save all into one chosen folder, so a zip isn't needed. Reason: photos are kept in Google Drive, and the Save dialog can save straight into it | [#1](https://github.com/dblevins-3dgfx/photo-fix/pull/1) |
| Q2 | 2026-11-07 | Should TIFF files open? | No; Yes, with a TIFF decoder library | **No** | TIFF is skipped with the unsupported-format message, which suggests JPEG or PNG (section 3, **Formats**). No decoder library was added. JPEG, PNG and WebP still open, since the browser decodes them all the same way at no extra cost. Reason: the scanner in use saves only JPEG | [#1](https://github.com/dblevins-3dgfx/photo-fix/pull/1) |
| Q1 | 2026-11-08 | Should Auto also even out the midtones? | Levels only; levels and midtones; both, as a choice | **Both, as a choice** | Auto has a **Midtones** switch, off by default (section 4, **Auto**): off is levels only, as before; on adds a power curve per channel that moves its median to the mean of the three. It is copied by Apply to all and cleared by Reset | [#9](https://github.com/dblevins-3dgfx/photo-fix/pull/9) |

## 12. Known limitations

- No undo history: Reset and Clear are the only way back.
- Zooming in on a large scan keeps its decoded original in memory (about 140 MB for 35 million pixels), which an iPhone may refuse; the preview then shows, softer.
- Nothing is kept between visits: closing or reloading the page closes every photo and loses its settings. The original files are never changed.
- 8 bits per channel throughout (section 3, **Bit depth**).
- The saved JPEG carries no color profile; it is in sRGB, which is what every phone, browser and photo app assumes.
- No dust, scratch or tear repair, no sharpening and no noise reduction.
- Tried on an iPhone: opening photos, the share sheet (**Save Image** to Photos, **Save to Files** to Google Drive, where an upload that stalls is the Drive app's, not Photo Fix's) and Safari's canvas limit (a large scan saved smaller, with its message). Chrome's **Save dialog** on a Chromebook, and Save all into a folder there, have not been confirmed on a real Chromebook yet.
