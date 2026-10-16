# Exterior B — glass and entrance correction

Review checkpoint, 2026-10-17. Continue from the approved Phase 2 state; this is **not** a new geometry pass. Stop for the user's approval after this correction. Do not merge, push, deploy or begin another phase.

## Branch and state

- Branch: `feature/exterior-b-form-camera`.
- Worktree: `C:/Users/ander/OneDrive/Skrivebord/Portifolio/verification/exterior-b-form-camera`.
- Starting commit: `4304dd7` (approved Phase 2 materials). Approved geometry remains from `68fb6bf`.
- On continuation, `loading-living-worker.js` already contained the material/camera correction, and `review/exterior-correction/check.mjs` was untracked. Those unfinished changes were preserved. No runtime design changes were added during the final verification/documentation continuation.
- Final runtime SHA-256, LF-normalized and trimmed: `cb643aaa893aada0a205bfec4fe0c3f7c5c6e07ad076b0eaddec1ef65a5644b3`.
- This document, evidence and correction are committed together. Use `git log -1 --oneline` and `git status --short` in this worktree to identify the resulting local checkpoint; a commit cannot embed its own final hash. Raw diagnostics under `verification/` remain ignored.
- Other worktrees, production main and the interior agent's work were not edited.

## Local review

- Comparison: http://127.0.0.1:8774/review/exterior-correction/
- Live exterior: http://127.0.0.1:8774/dev/living-exterior-preview.html
- Actual readiness-controlled entrance: http://127.0.0.1:8774/
- Previous Phase 2 review: http://127.0.0.1:8774/review/exterior-materials/

The loopback server was checked against the exact current worker bytes. If stopped, run `node review/exterior-form/serve.mjs` from this worktree. Do not start a duplicate on port 8774. The standalone preview does not initialize the room; use the root URL for the complete entry.

## Material correction

Only the shared `LIQUID` shader and the initial camera presentation in `loading-living-worker.js` changed relative to `4304dd7`.

- Replaced high-contrast, thresholded density with a narrow continuous density range. Reduced bright vein emission and removed the separate near-surface strand layer that reinforced the stone-like pattern.
- Reduced absorption through the four existing refracted optical samples so the glow is perceived deeper in the shell. The existing noise atlas and common world-space coordinates are reused.
- Rebalanced the teal inner emitter and added a faint curved current within those same optical samples. It has depth-dependent attenuation and a slow, restrained pulse; no extra mesh, texture, particle system or rendering pass was introduced.
- Reduced normal perturbation and the secondary elongated reflection for a cleaner glass surface. The existing key highlight and violet edge remain.
- Body, porch, tower and landing inherit the calmer shared material. Window, curtain, bronze and room-specific code is unchanged.

This removes much of the obvious marbling, but does **not** yet reproduce all the concept's luminous wisps and optical complexity. The result is darker and quieter, especially in the tower, and may still read too simple or opaque in a still image. It is a bounded glass approximation, not physical multi-bounce refraction. The entrance join and geometric facets are unchanged and remain visible. These are review limitations, not claims of reference parity.

## Entrance orientation

The exterior is presented **10 degrees more frontally**, implemented as an inverse orbit of the idle camera around the complete exterior. Mesh vertices and the shared door/room coordinates are not rotated. This achieves the requested relative rotation without breaking the cinematic approach into the actual room.

- At time 8.05 s, camera azimuth changes from 11.896358 degrees to 1.896358 degrees.
- Eye changes from `[2.37, 1.73, 11.25]` to `[0.38045238, 1.73, 11.49063340]`.
- A small horizontal target correction centres the actual door seam. Angle to the door's normal falls from 13.418617 degrees to 2.141441 degrees.
- Square 1024 px view: door moves from x=448.172 (43.77%) to x=512 (50%). Desktop 1600 px: 737.668 -> 800. Narrow 390 px: 172.525 -> 195. Landscape 844 px: 397.690 -> 422.
- Camera height, orbit radius and FOV policy are retained. The projected silhouette/landing perspective naturally changes with the view; world geometry and proportions do not.
- The approach starts from the corrected view and reaches the same landing. Arrival, curtains, walk, doorway aperture, entry timing and room camera handoff are unchanged.

The door is now mathematically centred and reads more frontally. The composition remains intentionally asymmetric because the approved tower stays on the right.

## Visual evidence

`review/exterior-correction/index.html` offers three comparisons:

1. Original Concept B versus corrected runtime.
2. Previous Phase 2 versus correction (both camera and material change).
3. **Material only:** previous Phase 2 versus current material at the identical previous camera, size and animation time. This prevents the angle change from masking the material difference.

Actual captures use 1024 x 1024, DPR 1, time 8.05 s; narrow view is 390 x 844, and integrated entry is 1600 x 1000. The original concept artwork is only cropped to its main view, never presented as a runtime result. The camera overrides for diagnostic angles exist only in the capture server's responses. Full integrated captures use actual runtime source.

Selected images: `review/exterior-correction/evidence/{corrected,material-only,entrance,tower,threequarter,mobile,entry}.png`.

Raw exact-final captures: `verification/exterior-form/correction-final/`. Earlier correction trials v1-v3 remain local. No post-processing or generated replacement renders were used.

## Performance impact and uncertainty

Windows, Chrome 155.0.8059.40, ANGLE D3D11, Intel Iris Xe driver 32.0.101.6881. DPR 1, same corrected camera for before/after, same geometry and viewport. Sequential runs, no simultaneous test browser. Each sample measures 12.5 s of idle after `seek(8.05)`.

The first independent final pair was inconsistent: corrected GPU medians were 10.812 / 7.236 ms (desktop/narrow), versus baseline 13.658 / 6.895 ms, while frame cadence changed from 33.3 to about 49 ms. Earlier correction runs also varied substantially. Those samples are retained; they do not establish a speedup.

One final **before / after / after / before** series used a single fresh Chrome session, with a fresh worker per page and the corrected camera applied to both sources. It showed a modest shader cost increase in the stable samples:

| Viewport | Previous material GPU medians | Corrected GPU medians | Interpretation |
| --- | --- | --- | --- |
| 1600 x 1000 | 26.954 ms first run; 13.744 ms last run | 14.417, 14.486 ms | About +5.1% versus the later warm baseline; the first run is an outlier and is retained, not averaged away |
| 390 x 844 | 6.872, 6.904 ms | 7.342, 7.231 ms | About +5.8% comparing the mean of the two medians |

CPU render medians were 0.4-0.8 ms across the series. Median frame intervals were 49.0-49.5 ms for **both** versions, approximately 20 fps, despite the unchanged 30 fps target. Earlier independent runs reached 33.3 ms (~30 fps). The cause of this run-to-run cadence variation was not established; it must not be attributed to the correction or hidden behind a claim that 30 fps always holds. GPU query counts in the final series were only 4-6 per sample, so percentile estimates are weak. This is indicative local evidence, not a precise universal regression percentage or a physical mobile measurement.

Allocated triangles remain 147,638. Instrumented idle draw calls remain 13, plus the same separate core halo (14 actual). Texture storage is unchanged, including the existing 256 x 256 RGBA noise atlas (256 KiB). The removed surface layer saves three texture lookups per shaded pixel, but the deeper current math still carries a small net measured shader cost. No resolution, geometry or quality reductions were introduced to offset it.

The one-time builder is byte-for-byte unchanged. Build times in the interleaved session varied from 4.09 to 5.50 s for both versions, versus roughly 1.2-2.2 s in earlier runs; this does not demonstrate a code-induced startup regression. Exact samples and source hashes are retained in `verification/exterior-correction/paired-final/performance.json`. Recheck on an undisturbed real device before release; this pass is not a general performance optimization.

## Verification

- JavaScript syntax: runtime, correction guard, paired benchmark and capture harness checked.
- `review/exterior-correction/check.mjs`: PASS on the exact final source. Geometry construction, vertex deformation, all other shader sections, readiness bridge and room files match `4304dd7`. Shared entry poses match at seven timestamps. Door centring and complete framing pass at 1024 x 1024, 1600 x 1000, 390 x 844 and 844 x 390.
- Exact-final standalone and integrated captures: zero console errors or warnings; actual room visible through the same curtain opening.
- All final performance runs: zero console errors or warnings.
- Actual lifecycle: PASS for cold/warm entry, input blocking until entry, worker/observer/listener cleanup, reduced-motion fade, no-WebGL fallback, missing orb and missing exterior module. Normal paths had zero console errors/warnings. The no-WebGL case emitted the three expected CSS-fallback warnings. No premature interaction was observed (485 cold / 738 warm / 76 reduced-motion guard samples).
- Actual cold: room ready at 23.505 s, formation at 24.427 s, entered at 35.470 s. Warm: 23.908 / 30.693 / 41.755 s. Reduced motion entered at 8.079 s. Initialization was slower in this session than the earlier Phase 2 test; the unchanged room/builder/readiness sources and variable baseline timings do not establish the cause. These are reported as an unresolved test-condition/startup concern, not as an improvement.
- Comparison page: PASS. All seven images loaded, Concept / Before / Material-only / return-to-Concept controls worked, and there were zero console errors. Actual review-page captures were inspected for layout and correct comparison pairing.
- Lifecycle evidence: `verification/living-exterior/exterior-correction/`. Comparison-page captures: `verification/exterior-form/correction-review/`. Compact source-linked results: `review/exterior-correction/verification-summary.json`.
- Prior full slow/fast/retry/mobile-resize/static-fallback fixture coverage remains in `verification/living-exterior/phase2-materials/`; the gate, bridge and entry logic are unchanged. The correction run focuses on actual entry rather than repeating every unchanged fixture.
- Earlier capture approval trouble was an approval-service usage limit, already resolved through normal approved Chrome requests. This pass uses the same approved local capture route; no security control was bypassed.

## Exact commands

Run in the worktree above. GPU tests must run sequentially. Use new output labels to preserve collected evidence; there is no need to rerun completed checks merely to resume work.

```powershell
git branch --show-current
git status --short
git log -1 --oneline
node --check loading-living-worker.js
node review/exterior-correction/check.mjs
node review/exterior-form/capture.mjs --out=correction-final
node review/exterior-correction/perf-paired.mjs --out=paired-final
node tests/living-lifecycle-check.mjs --actual-only --out=exterior-correction
node review/exterior-form/capture.mjs --review-page --review-route=review/exterior-correction/ --review-images=7 --out=correction-review
node review/exterior-form/serve.mjs
```

Independent final performance runs used `node review/exterior-form/perf.mjs --out=correction-final-perf-a` and `node review/exterior-form/perf.mjs --ref=4304dd7 --match-camera --out=correction-final-baseline`. Baseline sources are served from Git in memory, never checked out over unfinished work.

Historical Phase 1/Phase 2 guards assert their own phase boundaries and are not the correction guard. They have not been weakened to accommodate the new camera.

## Changed files and continuation

- `loading-living-worker.js`: optical shading and initial presentation only.
- `review/exterior-form/capture.mjs`: optionally validates/captures the material-only comparison button when present; old review behavior is retained.
- `review/exterior-correction/check.mjs`: geometry, shared-entry, framing and exact yaw guard.
- `review/exterior-correction/perf-paired.mjs`: reproducible interleaved benchmark using the established Chrome/CDP harness.
- `review/exterior-correction/index.html`, `evidence/`, `verification-summary.json`: local visual comparison and collected evidence.
- `EXTERIOR_CORRECTION_STATUS.md`: this handoff.

Stop for review. Ask the user to assess the glass's apparent depth versus excessive smoothness, whether the inner light is now too quiet, and whether the centred entrance feels right. Do not redesign the shell, add effects, change the room, merge, push or deploy without a newly agreed next step.
