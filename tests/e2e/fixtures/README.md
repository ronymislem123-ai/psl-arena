# E2E fixtures

- `portrait-a.jpg`, `portrait-b.jpg` — official United States government portraits (works of the U.S. federal government, public domain). Used only to exercise the detection → analysis → battle pipeline in automated tests.
- `turned-head.jpg` — CGI render (sample image from the `vladmandic/human` repository, used for the "head turned too far" rejection test).

These files are test fixtures, not product assets.
- `profile-synthetic.jpg` — synthetic profile silhouette rendered by a script (no real person). Its 16 landmark coordinates are listed in `tests/e2e/side-view.spec.ts` and match the hand-computed values in `tests/unit/side-view.test.ts`.
- `profile-scan.jpg`, `profile-scan-left.jpg` — renders of the 3D head scan "Lee Perry-Smith" (© Infinite-Realities, CC BY 3.0, distributed with the three.js examples) in right and left profile, made with a WebGL script in this project. Used to test the automatic side view (person segmentation → profile landmarks) on a realistic head. The texture of the scan is slightly misaligned at the lips; the geometry is unaffected.
