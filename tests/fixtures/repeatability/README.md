# Repeatability fixtures

MediaPipe Face Landmarker detections (same model and runtime as the app) of
`tests/e2e/fixtures/portrait-a.jpg` and `portrait-b.jpg` (public-domain U.S.
government portraits) under 17–18 controlled nuisance changes each: shifts,
scales 0.85–1.07, rotations ±2/±4°, JPEG quality 60/80, brightness ±15 %,
contrast −20 %, blur 1 px, and the original. `*__transforms.json` holds the
affine transform of every variant (variant → source), so landmarks can be mapped
back to the source frame.

Produced with `scripts/research/perturb.py` and `scripts/research/detect-images.mjs`;
coordinates rounded to 0.01 px. Used by `scripts/research/repeatability.py`,
`scripts/research/noise-model.py` and the validation suite
(`tests/research/validation.test.ts`). The same two portraits are already used as
landmark fixtures; reports refer to them only as "portrait A/B" and never publish
scores under a person's name.
