# Exterior B — Phase 2: materials, depth and luminous atmosphere

This is the continuation of the user's approved Phase 1 form/camera result. Concept B remains the design reference. Phase 2 is a material review checkpoint, **not approval to remodel, merge, push, deploy or continue to another phase**.

## Isolation and state

- Branch: `feature/exterior-b-form-camera`.
- Worktree: `C:/Users/ander/OneDrive/Skrivebord/Portifolio/verification/exterior-b-form-camera`.
- Phase 2 starting HEAD: `d15648882af341d4cf18e8a095b8de65f991150d`, clean. Approved form implementation: `68fb6bf`.
- Only this worktree was edited. No other agent's branch was checked out or overwritten. No merge, push, publication or deployment.
- Runtime source SHA-256 (LF normalized, trimmed): `7b87ade050b7f2037b7433ba67716b46fbabe5554a8570ce26a9c725949ca738`.
- Use `git log -2 --oneline` and `git status --short` here to identify the final local checkpoint. This handoff and evidence are committed together with the implementation; raw diagnostic runs remain ignored.

## Preview

- Comparison: http://127.0.0.1:8774/review/exterior-materials/
- Live exterior: http://127.0.0.1:8774/dev/living-exterior-preview.html
- Complete readiness-controlled entrance: http://127.0.0.1:8774/
- Archived approved form comparison: http://127.0.0.1:8774/review/exterior-form/

If the existing server is not running, from this worktree run `node review/exterior-form/serve.mjs`. It listens on loopback only. Do not start another server on 8774 if the existing one already serves this worktree. The served worker bytes were checked against the current source. The standalone preview's entry button does not load the room; use the root URL to assess the actual entrance.

## What changed

`loading-living-worker.js` is the only runtime file changed.

- The glass now integrates four fixed optical layers along the refracted view, with front-mist absorption and a localized teal/aqua light source inside the dome. It uses the existing deterministic 256 KiB noise atlas. This is a bounded approximation of depth, without iterative surface tracing, additional render targets or another scene.
- Shared world-space material coordinates run over the body, porch and tower. The porch's former independent dark multiplier was removed. The approved mesh, including the visible porch join, is retained.
- The material retains darker pockets, subtler blue/violet edge reflections and controlled near-surface currents. The key reflection was moved higher and made sharper; the broad flat environment reflection was reduced.
- Window glass has warmer luminous lower panes, violet heads and finer lead lines. Its light spill now fades to zero before the shader lookup boundary, fixing the rectangular light patches that were visible around tower windows.
- Window mouldings and the landing use the same liquid-mineral shading family. Bronze is darker and warmer. The landing carries a restrained warm entrance reflection.
- Curtains are darker violet with a warm central seam. Their shape, aperture and opening are unchanged.
- The existing clock drives all material motion. Reduced motion still fixes material time at 8 and stops idle rendering. Formation, breathing geometry, flight, camera, input blocking and cleanup are untouched.

No new texture downloads, lights, geometry, particles or post-processing passes. No actual room content, material or lighting changes. The material references the real orb's layered mist, absorption, teal inner light, violet grazing light and glass highlight language from `portal-orb-material.js`; the orb itself is untouched.

## Visual comparison and limits

All review screenshots are actual browser output. The matched still is 1024 x 1024, DPR 1, time 8.05 s, with the approved camera. The original artwork is `review/exterior-visual-upgrade/concept-b.png`; the comparison page crops only its right-hand detail column.

Compared with Phase 1, the dome has much more internal luminosity, the entrance shares its material with the body, and the purple curtain/bronze/warm-window balance is closer to the reference. The surface remains darker than the rejected bright, thin-contour trials.

Remaining differences are visible and should be reviewed honestly:

- The reference has more finely sculpted, wispy internal structure and more complex reflections. The bounded real-time mist is softer and can read as marbling, especially close up.
- The porch join remains visible. The approved roof edge and window mouldings still have geometric facets; this pass deliberately preserves that geometry.
- The landing is less intricately veined and reflective than the artwork.
- Four optical samples approximate absorption and parallax; they are not full multiple-scattering glass or a transparent view into the actual room.
- Visual approval should focus on the dome's brightness/depth, saturation of teal against violet, entrance/tower cohesion, and how the material moves in the live preview.

## Performance

Windows, Chrome 155.0.8059.40, ANGLE D3D11, Intel Iris Xe driver 32.0.101.6881. Fresh temporary Chrome profile per command, DPR 1, same geometry/camera. Each viewport runs sequentially for 12.5 s of idle after `seek(8.05)`. Approximately 11–12 GPU queries per viewport; percentile estimates are therefore limited. These are local headless measurements, not physical-phone results.

The final same-session pair, with the exact final shader measured first and the Phase 1 baseline immediately afterward:

| Metric | Approved Phase 1 | Phase 2 | Difference |
| --- | ---: | ---: | ---: |
| Desktop 1600 x 1000 GPU median | 9.523 ms | 10.292 ms | +0.769 ms / +8.1% |
| Desktop GPU p95 | 10.670 ms | 13.634 ms | +2.964 ms |
| Narrow 390 x 844 GPU median | 4.891 ms | 7.047 ms | +2.156 ms / +44.1% |
| Narrow GPU p95 | 5.477 ms | 7.139 ms | +1.662 ms |
| Idle frame interval, both sizes | 33.4 ms | 33.4 ms | target ~30 fps retained |
| CPU render median, both sizes | 0.2 ms | 0.2 ms | unchanged |
| Allocated mesh triangles | 147,638 | 147,638 | unchanged |
| Instrumented idle draw calls | 13 | 13 | unchanged; both also draw one core halo |

Source artifacts: `verification/exterior-form/phase2-final-b/performance.json` and `phase2-baseline-c/performance.json`. A nearby pair before the final window-spill correction measured 9.304 -> 10.244 ms desktop and 4.901 -> 6.994 ms narrow.

The first earlier Phase 1 run measured only 4.443 ms desktop / 4.018 ms narrow. Absolute GPU timing varied materially during the session; that earlier baseline is retained in the summary, not silently discarded. The nearby paired runs are the stronger comparison, but the shader is measurably more expensive. Real-device mobile verification is still recommended before release.

The six-layer trial cost 10.587 ms desktop / 8.862 ms narrow. Four layers reduced the narrow-view cost while retaining the depth effect. No viewport-resolution or mesh reductions were introduced to hide the added cost.

One-time mesh build in the final pair: 1.216 -> 1.523 s desktop and 1.818 -> 2.014 s narrow. The builder is byte-for-byte unchanged, so these samples do not establish a build regression or improvement. Existing startup work remains. This pass is not a loading-time optimization.

## Verification

- `node --check loading-living-worker.js` — passed.
- `node review/exterior-materials/check.mjs` — passed: geometry construction, vertex deformation, camera, all runtime code after the shaders, aperture, window mapping, readiness bridge and room files match `d156488`.
- Final standalone and integrated captures — no console errors or warnings. Full entry reaches the original room through the same doorway.
- Full lifecycle suite ? passed: cold and warm entry, fast/slow readiness, input blocking until entry, retry/degraded guard, mobile resize, reduced-motion fade, missing gate, no-OffscreenCanvas fallback, no-WebGL room fallback, missing orb and missing exterior module. Normal cold/warm entries recorded zero console errors; deliberate missing-resource cases were handled as expected. Worker/observer/listener cleanup passed.
- Comparison page ? all seven images loaded, Concept/Phase 2 and Phase 1/Phase 2 controls passed, zero console errors. Captures are in `verification/exterior-form/phase2-review/`.
- Final review completed on 2026-10-16. The interrupted lifecycle process was resumed to read its already-completed result; no material edits or repeat performance/lifecycle runs were made on that continuation.

Measured actual entry on this PC: cold ready at 7.841 s, formation at 12.112 s, entered at 23.146 s; warm ready at 5.509 s, formation at 12.131 s, entered at 23.168 s. Reduced-motion narrow view entered at 3.966 s. The existing initialization and cinematic duration remain substantial; these numbers are not a claim of faster loading. The experience stayed inert until entry.

The old `review/exterior-form/check.mjs` intentionally asserts that materials never change in Phase 1. It is historical evidence and is not the Phase 2 check. It has not been weakened.

## Reproduction commands

Run in the worktree above. Chrome processes use hidden temporary profiles. On this machine Chrome/CDP requires the normal elevated tool approval; the initial retry was blocked because the approval service hit a usage limit, not because it judged the action unsafe. A subsequent identical request passed normal approval. No security controls were bypassed.

```powershell
node --check loading-living-worker.js
node review/exterior-materials/check.mjs
node review/exterior-form/capture.mjs --out=phase2-final
node review/exterior-form/perf.mjs --out=phase2-final-b
node review/exterior-form/perf.mjs --ref=d156488 --out=phase2-baseline-c
node tests/living-lifecycle-check.mjs --out=phase2-materials
node review/exterior-form/capture.mjs --review-page --review-route=review/exterior-materials/ --review-images=7 --out=phase2-review
node review/exterior-form/serve.mjs
```

Run GPU measurements sequentially, not while another browser test is rendering. Rerunning with the same output label overwrites that diagnostic folder; use a new `--out=` label to retain existing evidence. Capture/perf scripts serve baseline source in memory; they never check out or replace the working source. Standalone side/rear cameras are diagnostic response-only overrides; integrated entry captures use the actual source.

## Files and artifacts

- `loading-living-worker.js` — material and lighting changes described above.
- `review/exterior-form/capture.mjs` — optional review route/image-count arguments; original defaults and Phase 1 behavior retained.
- `review/exterior-materials/index.html` — Concept B / Phase 2 and Phase 1 / Phase 2 comparison, detail views and preview links.
- `review/exterior-materials/check.mjs` — approved geometry/camera/flow regression guard.
- `review/exterior-materials/verification-summary.json` — final source hash, measured samples, conditions and test results.
- `review/exterior-materials/evidence/` — six selected PNGs: phase2, entrance, tower, threequarter, mobile, entry.
- `EXTERIOR_MATERIALS_PHASE2.md` — this handoff.

Full ignored captures: `verification/exterior-form/phase2-final/` (front, reference angle, three-quarter, rear, entrance, tower, mobile, arrival, curtains, threshold, room). Iteration captures `phase2-material-v1` through `v9` are retained where collected. Lifecycle evidence: `verification/living-exterior/phase2-materials/`. Review-page captures: `verification/exterior-form/phase2-review/`.

## Continuation boundary

Stop here for the user's Phase 2 visual approval. Do not resume another agent's worktree, remodel the approved silhouette, merge, push or deploy. If approved, first establish the next scope and assess the remaining glass-detail/porch-join fidelity and real-mobile performance; neither is silently claimed complete here.
