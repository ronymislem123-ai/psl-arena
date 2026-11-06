# Privacy, security and ethics

* **Local detection.** Face detection, landmarking, quality analysis and the live preview run in the browser (MediaPipe WASM served from this origin). No third-party request is made during analysis.
* **What the server receives.** Landmark coordinates, blendshape coefficients, the head-pose matrix and summary quality numbers. The photo itself is only sent when "Store photos in history" is enabled.
* **Encryption at rest.** Stored photos are AES-256-GCM encrypted on disk; the key is `PSL_ARENA_IMAGE_KEY` or an auto-generated `image.key` (mode 0600). Photos are served only through `/api/images/:id` with no-sniff and a restrictive CSP.
* **Consent gate.** Before a battle can start, the user confirms the right to use the photos, the depicted persons' agreement and that both persons are adults.
* **Deletion & export.** Profiles, analyses, battles and photos can be deleted individually; Settings offers export (JSON) and "delete all data".
* **Input validation.** All API bodies are validated with zod (478-point mesh, numeric ranges, image size limit); unusable images are rejected server-side (HTTP 422).
* **Headers.** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (camera/microphone/geolocation off).
* **No sensitive inference.** The engine only computes geometric proportions. It does not and cannot infer ethnicity, religion, health, sexual orientation or any protected attribute, and the UI avoids degrading language (neutral score descriptors only).
* **Scope.** Reference ranges are community conventions, not validated beauty standards; results are a voluntary geometric comparison for consenting adults.
* **Open point.** Authentication/multi-user isolation is not implemented (single local user); run the app on a trusted machine or add auth before exposing it on a network.
