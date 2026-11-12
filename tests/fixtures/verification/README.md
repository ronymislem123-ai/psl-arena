# Verification fixtures (engine 3.1)

Analysis inputs exactly as the app sends them to `/api/ratings`: the MediaPipe
detection of the unchanged photo (`mesh`) plus the five verification passes
(`verification.passes`: mirrored, rotated +5° / −5°, zoomed face crop, zoomed and
mirrored), each mapped back to the photo's pixels, with the hairline estimate per
pass. Captured from the running app (Playwright, Chromium, same model and runtime)
for `tests/e2e/fixtures/portrait-a*.jpg`, `portrait-b.jpg` (public-domain U.S.
government portraits, referred to only as "portrait A/B") and the synthetic
`docs/images/ideal-example-render.png`. Coordinates rounded to 0.01 px; the image
appearance values are not included.

Used by `tests/unit/verification.test.ts` and the rating/store tests.
