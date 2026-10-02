# Verification

## Policy

- Every component with non-trivial logic has a plan in `verification/` before its code: claims, oracle, method,
  corpus, thresholds, known gaps.
- A check that did not run is not passed. Results go into the plan with the date they were measured.
- Headless screenshots (`tools/render.ts`) are evidence for layout only, not for pen feel or real input devices.
- Nothing in the tests talks to a real sync server or the user's boards.

## Plans

None yet; the first one comes with the model in phase 1.
