# Exterior B — visible currents and straight landing

Local review checkpoint, 2026-10-20. User requested slightly more visible internal currents and a platform pointing toward the viewer. Stop for approval after these two corrections. No merge, push or deployment.

## State and preview

- Branch: `feature/exterior-b-form-camera`.
- Worktree: `C:/Users/ander/OneDrive/Skrivebord/Portifolio/verification/exterior-b-form-camera`.
- Starting HEAD: `25543df`, clean. All previous material and camera work retained.
- Runtime SHA-256 (LF-normalized, trimmed): `678d58b1328e193fb18dee27884e1737892655f77d99a0c9160c35998a120aca`.
- Final checkpoint contains this handoff, source and evidence together; use `git log -1 --oneline` and `git status --short` here for its final commit and state.
- Review: http://127.0.0.1:8774/review/exterior-flow-landing/
- Live: http://127.0.0.1:8774/dev/living-exterior-preview.html
- Complete entrance: http://127.0.0.1:8774/

If the loopback server has stopped, run `node review/exterior-form/serve.mjs` from this worktree. Do not start a duplicate server on 8774.

## Changes

Only `loading-living-worker.js` changes runtime behavior.

- Increased the existing inner vein contribution from .008 to .024, low diffuse contribution from .007 to .009, depth-light multiplier from 5 to 7.5 and curved-current contribution from .65 to 1.4. These are shader coefficients, not claims of corresponding screen-brightness multipliers. Density contrast, sample count, optical depth, reflections, color palette and animation speed are unchanged. The intent is visible flowing strands without restoring the earlier high-contrast marble patches.
- Replaced the platform's curved leftward centreline with a straight camera-facing axis, 2.14 degrees from the door normal. Its doorway root remains fixed; length is still 1.72 scene units, and every y/z vertex coordinate and width profile is retained. The tip moves from x=-.92 to approximately +.064. The bronze rim's shader uses the same updated outline.
- At the review camera, platform tip and door align within .014 pixels horizontally in the 1024-square view. Alignment also passes desktop, narrow and landscape views. This is a fixed authored platform direction, not geometry that follows the camera every frame.
- Body, tower, doorway, camera, formation/entry timing, room and readiness code are unchanged. The entry centreline remains fully supported by the level platform. The user explicitly authorized this local platform correction; the rest of the approved geometry is preserved.

The new front capture visibly restores fine teal strands and a clearer inner curl. The platform points straight toward the viewer. The concept still has richer optical structure; the existing porch join and facets are unchanged. Await the user's judgment of current visibility rather than broadening the design.

## Verification and performance

- Syntax and diff checks passed.
- `review/exterior-flow-landing/check.mjs` passed: source outside the liquid/terrace regions is identical to `25543df`; platform topology/y/z/width preserved; finite normals; entry support; tip/door alignment at four aspect ratios. Historical phase guards remain unchanged.
- Exact-source standalone, close-up, mobile and integrated entry captures passed with zero console errors or warnings. The real room is reached through the same door. Full prior lifecycle results remain in `review/exterior-correction/verification-summary.json`; unchanged gate/entry code was not subjected to another redundant full fallback suite.
- Performance: sequential before/after/after/before, Chrome Chrome/155.0.8059.85, ANGLE D3D11, same camera, DPR 1, 12.5 seconds per sample. All samples retained a 33.3 ms median frame interval (~30 fps), CPU render medians 0.2-0.3 ms. Desktop GPU medians before 5.968 / 6.539 ms; after 13.540 / 6.210 ms. Narrow before 4.587 / 7.761 ms; after 4.328 / 4.203 ms. The large outliers are retained. No consistent regression or reliable speedup is established; do not average away the outliers or claim a fixed improvement. Geometry remains 147,638 allocated triangles and 13 instrumented draws plus the existing halo. No new samples, textures or passes. Desktop emulation is not a physical phone test.
- Review page: seven images loaded and both comparison controls passed with zero console errors. The before/after screenshot was inspected.

## Evidence and reproduction

New review page and selected images: `review/exterior-flow-landing/`. Before image is the previous committed correction; both before/after use the same camera, time 8.05 s, 1024 x 1024 and DPR 1. The original Concept B remains separately selectable. The live preview is required to judge continuous motion.

Raw full capture: `verification/exterior-form/flow-landing-v1/`. Geometry check: `verification/exterior-flow-landing/check.json`. Sequential A/B/B/A performance: `verification/exterior-correction/flow-landing-paired/performance.json`. Review-page capture: `verification/exterior-form/flow-landing-review-utf8/`. No edited/generated images are passed off as runtime evidence.

```powershell
node --check loading-living-worker.js
node review/exterior-flow-landing/check.mjs
node review/exterior-form/capture.mjs --out=flow-landing-v1
node review/exterior-correction/perf-paired.mjs --ref=25543df --out=flow-landing-paired
node review/exterior-form/capture.mjs --review-page --review-route=review/exterior-flow-landing/ --review-images=7 --out=flow-landing-review
```

Use new output labels for future reruns to retain evidence. Run GPU tests sequentially. Chrome runs through the same approved local capture route with temporary profiles; no security controls were bypassed.

Files: runtime worker; new review page, six selected PNGs, focused check and verification summary; this handoff; optional `--ref=` argument added to the existing paired benchmark (old default retained). Other worktrees and archived comparisons are untouched. Stop here for approval.
