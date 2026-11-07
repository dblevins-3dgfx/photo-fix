# SPEC.md rules without unit tests

Every rule in `SPEC.md` should have a unit test in `src/lib/*.test.ts` that fails if the rule breaks. This file lists the rules that don't, and why. Keep it current: a pull request that adds or changes a spec rule either tests it or adds a row here, and one that adds a test for a rule listed here removes its row.

The tests only reach plain functions in `src/lib`. Code inside a React component or hook, the Web Worker, and anything that needs a browser (decoding and encoding images, canvas drawing, the share sheet, downloads, localStorage, the service worker) is untested. The fix is usually to move the decision into a function in `src/lib` and have the component call it.

## Untested rules

No code has been written yet, so there are no rows. The first code pull request adds a row for each rule it implements without a test.

| Spec section | Rule | Where it lives | Why it isn't tested |
| --- | --- | --- | --- |
