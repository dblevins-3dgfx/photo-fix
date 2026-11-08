# Keep SPEC.md in step with the code

`SPEC.md` describes Photo Fix as it is implemented. Any change a user can see, or that changes what is stored (opening photos, the corrections, saving, the screen, the settings kept in the browser, installing and offline use), updates `SPEC.md` in the same pull request. The PR description names the spec sections that changed, or says why none needed to.

Every open question has a permanent number (Q1, Q2, ...). A new question takes the next number, which the spec's Open questions section names; update that note when you use it. Never renumber a question or reuse a number, and refer to questions by number in the spec, the app, pull requests and commits.

Each open question has a GitHub issue of its own, titled with its number ("Q11: ..."), holding its options, which one is built, and its **Depends on** note. Open the issue when the question is opened, and link it under the question's heading in `SPEC.md` (`Issue: [#n](...)`). When the question is decided, the pull request that resolves it closes the issue.

When an open question in `SPEC.md` is decided, move the answer into the section it belongs to and remove the options that lost, from the spec, the code and the tests. Then add a row to the spec's **Resolved questions** section: its number, the date, the question, the options tried, the decision, what changed, the reason if one was given, and the pull request.

# Test every spec rule

A pull request that adds or changes a rule in `SPEC.md` adds or updates the unit tests for it (`src/lib/*.test.ts`, run with `npm test`) in the same pull request. Put the rule's logic in a plain function in `src/lib`, with no React and no DOM, so it can be tested; React hooks and components, and the Web Worker, should only call it. Pixel math works on plain arrays (`Uint8ClampedArray`, as in `ImageData.data`), so the tests need no canvas. A rule that can't be unit-tested (decoding and encoding images, canvas drawing, the Web Worker, the share sheet and downloads, storage, pointer events, layout) gets a row in `untested-requirements.md` saying where it lives and why. Remove a row from that file when its rule gains a test.

# How to work

- Read the relevant code before editing. Do not guess file paths or APIs.
- Make the smallest change that solves the request. Do not refactor unrelated code.
- Match the style of the surrounding file: naming, imports, error handling, comments.
- Do not add dependencies, config files, or abstractions unless asked or named in `SPEC.md` (section 2, Technology).
- Do not commit, push, or open a pull request unless asked.

## Before saying you are done

- Run the project's checks for the files you touched (`npm run typecheck`, `npm run lint`, `npm test`).
- If you cannot run them, say so and name the command the user should run.
- Summarize what changed and anything you did not verify.

## When unsure

- Ask one clarifying question instead of picking an interpretation and building on it.
- If two approaches are reasonable, name both in one sentence and recommend one.
