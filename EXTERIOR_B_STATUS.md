# Exterior B ? Codex review handoff

Approved direction: **B / Liquid Sanctuary**, with a moderate increase in rendering cost for additional detail. Runtime implementation, visual verification and cost measurements are scoped to the exterior. No room redesign, loading-gate rewrite, deployment, push or merge.

## Exact continuation point and isolation

- Published main verified at task start: `11e0c10ee169a4d62c6fb9e71b6ff2318afa3d79`.
- Parent: `63072d38729e8cf8c750150f3dc5519bb92de836`. This existing checkpoint had already been added to the original concept worktree when B was approved. The B pass replaced its bronze cage/stone skirts with the approved continuous glass direction.
- **Active branch: `feature/exterior-visual-upgrade-b-codex`.**
- **Active worktree: `C:/Users/ander/OneDrive/Skrivebord/Portifolio/verification/exterior-visual-upgrade-b-codex`.**
- On 2026-10-13 the user explicitly requested continuing Codex's own checkpoint, not Claude's later work. The previous B worktree had acquired later uncommitted helper-worker changes. It has been left untouched.
- Codex's exact source was recovered from Git blob `9a83e60`. Normalized SHA-256: `c4fa8a746012fa054ca967e44f0efca96ba1897264e8969ee2df220080eeddae`.
- Undoing only Codex's last window-antialiasing fix in memory reproduces the recorded B screenshot source hash `b2efc0866cd2eb9a23e0545c0bda0a64de452cc80a4dd1d1d06fafa2d0406f85`. This proves the recovery point. Claude's later source and test output are not included or used as evidence here.
- No other worktree, main or remote branch was modified. Use `git log -3 --oneline` and `git status --short` here for the current checkpoint.

## What changed

The only runtime file changed by this B pass is **loading-living-worker.js**.

- A smooth field union creates one continuous chamber/tower skin. Welded marching-tetrahedra geometry is generated once in the existing renderer worker. Field-gradient normals, two projection passes and an analytic needle tip remove the obvious primitive junction and blunt spire.
- Rounded underside and restrained diagonal pressure folds replace the stone skirt and dome cage. Window mouldings follow the same folded surface and breathing transform.
- A nested, polished Gothic porch frames the existing human-scale aperture. Fine bronze is concentrated at the inner reveal, sills and landing lip. The landing is level, shallow and rounded.
- Four chamber lancets, the rear great window and three existing stair lancets have dark reveals and warm/violet inset glazing. Window antialiasing uses continuous world coordinates to avoid false vertical light seams between angular bays.
- Two refracted depth layers carry slowly turning teal currents, dark absorption pockets, violet reflections and selective glass highlights. A deterministic 256 x 256 RGBA noise atlas is generated locally once (256 KiB), with no downloads or per-frame texture upload. It is deleted on disposal.
- Dark fitted curtains and a thin warm seam keep the doorway dominant. A final review fix clips gathered fabric to the existing arch, removing tips that previously protruded through the porch when opening. The golden core floats free when formation finishes.

No changes to gate readiness, room interaction guards, room geometry, lighting, materials, camera path, movement timing, stylesheet or fallback architecture. Formation remains 6.6 s of animation time; entry remains approach 2.6 s, arrival 2 s, curtains 1.4 s, walk 5 s. Door half-width 0.74 m, height 2.54 m, plane 5.35 m from chamber centre. Scene scale 0.246 units/m. Main body about 8.7 m diameter; tower about 4.1 m diameter, tip 11.7 m above the floor.

## Art direction assessment

Published-main weaknesses were specific: the separate drum/cone junction, a visibly polygonal keel, flat luminous window patches, repeated thin surface lines, an undifferentiated landing and a porch that looked applied to the body. The floating silhouette, single tower, small solar core, intimate scale and dark void were deliberate identity choices and were retained.

B addresses the structural junction and window depth, establishes material hierarchy, and gives the door a crafted surround. The concept image is **AI-generated art direction**, not a screenshot or a claim of runtime fidelity. Current glass still has less fine cloudy depth and less nuanced reflected light than that concept. This is a real-time procedural interpretation, submitted for visual review; it is not claimed to match an offline cinematic render.

## Verification and measurements

Existing Codex checks from 2026-10-12 passed with no unexpected console errors: full camera handoff, input blocked through entry, actual readiness before entry, resource cleanup, cold/warm room loads, fast/slow readiness, retry/degraded guard, mobile resize, reduced motion, missing OffscreenCanvas, missing gate script, no room WebGL and missing modules.

Review-only sources: `review/exterior-visual-upgrade/`. Local screenshots and raw JSON are gitignored under `verification/exterior-visual-upgrade/` and `verification/living-exterior/`.

## Continuation rules

Continue from this branch and its latest commit, not the old Claude session or the other B worktree. Review the visual result before further art changes. Do not cherry-pick later helper-worker or shader experiments implicitly. Preserve the shared door aperture, camera route and readiness/interaction contract. Nothing has been published.

## Measured cost — own Codex runs, 2026-10-13

Headless Chrome 155.0.8059.40, Windows, ANGLE D3D11, Intel Iris Xe Graphics (driver 32.0.101.6881), DPR 1. Sequential fresh-profile commands in the order published, B, published, B. Each loads the isolated exterior preview, seeks to 8.05 s, plays for 12.5 s and collects 11–13 GPU timer queries plus frame/CPU samples. No simultaneous browser benchmark was run. The 390 x 844 case is a desktop GPU with a small viewport, **not phone hardware**. Desktop runs start cold in each profile; mobile follows desktop in that profile, so startup cache state differs.

| Metric | Published main 11e0c10 | Codex B |
| --- | --- | --- |
| Desktop GPU median, two runs | 5.54 / 5.50 ms | 6.33 / 6.34 ms |
| Desktop GPU p95 | 5.80 / 5.54 ms | 7.02 / 6.36 ms |
| Small viewport GPU median | 3.75 / 3.20 ms | 4.21 / 4.13 ms |
| Small viewport GPU p95 | 3.99 / 3.27 ms | 5.01 / 4.15 ms |
| Idle frame median, all runs | 33.3 ms | 33.3 ms |
| Idle frame p95, all runs | 33.4–33.5 ms | 33.4–33.5 ms |
| CPU render median | 0.2–0.3 ms | 0.2–0.3 ms |
| Allocated mesh triangles | 81,162 | 117,730 |
| Instrumented idle draw calls | 10 | 13 |
| Desktop worker-to-first-draw | 1,094 / 1,115 ms | 1,520 / 1,392 ms |
| B one-time shell/fittings build | not instrumented | 1,468 / 1,603 ms desktop; 1,094 / 1,185 ms small viewport |

The idle renderer intentionally targets 30 FPS. These results establish a moderate **14–15% desktop / 12–29% small-viewport GPU increase**, not a throughput/FPS improvement. Triangle allocation rises 45%. Draw-call counters omit the common final halo draw in both versions; actual idle submissions are therefore 11 and 14. The triangle figure is allocated geometry, not a rasterizer primitive query. Per-frame CPU figures exclude the one-time build after warmup.

Raw measurements: `verification/exterior-visual-upgrade/codex-baseline-1/`, `codex-b-1/`, `codex-baseline-2/`, `codex-b-2/`. Each contains `performance.json` with sample arrays and browser/GPU information. Earlier measurements varied substantially with machine state, so use these interleaved pairs, not a cherry-picked older minimum. Timings are local browser observations, not production-user telemetry or statistically powered benchmarks. These pairs precede the last curtain clipping fix; a final-source confirmation is recorded separately below.

The one-time synchronous mesh build is a genuine remaining startup cost. It runs in the existing renderer worker, so the initial seed/fallback and main-thread gate remain available, but the worker animation can pause while it builds. It is **not** acceptable to call this a seamless production-ready startup. A future pass should remove that pause without changing the approved geometry or readiness contract. This handoff intentionally does not import Claude's later helper-worker architecture.

## Exact verification and preview commands

Run from this worktree, using Node 24 and Chrome (or set `CHROME_PATH`). No install/build step is required.

```powershell
node --check loading-living-worker.js
node review/exterior-visual-upgrade/capture.mjs --out=codex-final
node tests/living-exterior-check.mjs --out=codex-final --sequence
node tests/living-lifecycle-check.mjs --out=codex-final
node review/exterior-visual-upgrade/perf.mjs --ref=11e0c10 --out=baseline
node review/exterior-visual-upgrade/perf.mjs --out=b-confirmation
node review/exterior-visual-upgrade/serve.mjs
```

Local review: `http://127.0.0.1:8771/review/exterior-visual-upgrade/`. Full real entry: `http://127.0.0.1:8771/`. Standalone controllable exterior: `http://127.0.0.1:8771/dev/living-exterior-preview.html`.

Screenshots: `verification/exterior-visual-upgrade/codex-final/gate-front-current.png`, `gate-left-three-quarter.png`, `gate-right-three-quarter.png`, `gate-entrance-detail.png`, `gate-mobile-current.png`, and the arrival/curtains/threshold/room frames. Before screenshots: `published-visual/`. The gallery links those local files; they are deliberately gitignored and can be regenerated. For arbitrary side/rear inspection only, the capture server overrides the camera and bypasses the cinematic door-plane discard in HTTP response bytes. The root-page room/entry screenshots and integration tests use the actual worker, with no diagnostic substitutions.

## Follow-up before publishing

1. Review B visually in motion. The real-time material is still simpler than the approved concept's cloudy depth and reflected light. Side/rear window framing is less sophisticated than the entrance. No claim of pixel-identical concept reproduction.
2. Remove the one-time meshing pause; preserve this shape/material as the reference while measuring the change.
3. Test a physical phone and normal visible browser on target hardware. Headless viewport emulation does not establish a mobile thermal/memory budget. Long-session memory stability has not been profiled in this exterior pass.
4. Existing world-consistency limitations remain: decorative chamber clerestory windows do not have matching interior openings; the outer curtain and interior closed door are different surfaces; some room UI appears during the final passage, while still inert. Fixing these requires coordinated scope with the interior/entry owner.
5. Do not merge/push/deploy until the user reviews this branch. Main and the other worktrees remain separate.

## Final verification checkpoint

Runtime implementation commit: **330e5ffa680c889c615ccc72f6873b22f1b6414c**. Final runtime source SHA-256 (normalized LF, trimmed): **f42853bdd6e2fba14beb00bfc0c6edb52724cbeca1fb7b5ecf10508fc1454965**. A following documentation-only commit records the final test results; use this branch's latest HEAD. The working tree was clean before that documentation update and is checked again after committing it.

Final-source checks completed:

- JavaScript syntax and `git diff --check`: pass.
- Multi-view desktop/mobile-format screenshots and actual room/orb captures: pass; `verification/exterior-visual-upgrade/codex-final/inspection.json` has zero errors/warnings and the final source hash above.
- Full camera-path sequence: pass. Real readiness precedes entry, input stays inert until completion, the camera hands back at the existing entry, and worker/observer/listeners are disposed. Exact published `pose`, `walked` and `setEntry` function bodies were compared and are unchanged. The sequence test seeks through poses, so its frame numbers are not a natural-playback FPS benchmark.
- Lifecycle suite: pass. Cold/warm actual room, fast/slow readiness, retry and degraded guard, mobile/landscape resize, reduced motion, absent OffscreenCanvas, missing gate script, no room WebGL, missing orb module and missing exterior module. Expected missing-resource failures are injected deliberately. Saved cases record zero unexpected errors. Summary: `verification/living-exterior/codex-final/lifecycle-summary.json`.
- Natural full-entry lifecycle runs: cold readiness 11,039 ms / formation 13,703 ms / entered 24,738 ms; warm 7,143 / 13,056 / 24,087 ms. These include room initialization and the 11-second entry; they are not loading improvements. Main-thread long tasks of 3,052 ms cold and 1,041 ms warm were recorded. Their attribution was not profiled in this exterior pass. Do not claim those existing room costs are solved.
- Final shader (including curtain clipping) confirmation: desktop GPU median **6.36 ms**, p95 **8.08 ms**, one-time build **1,420 ms**, first draw **1,348 ms**; small viewport GPU median **3.97 ms**, p95 **9.27 ms**, build **1,091 ms**, first draw **183 ms**. Idle frame median **33.3 ms**, p95 **33.5 ms** in both. 11/12 GPU samples, zero console errors or warnings. Raw JSON: `verification/exterior-visual-upgrade/codex-final-performance/performance.json`. The higher p95 values are retained rather than hidden; this small sample does not establish a guaranteed frame-time ceiling.
- Local gallery image paths resolve. Preview helper serves only localhost. No merge, push, deployment or main-branch edit.

Changed files in this pass: `loading-living-worker.js`; `EXTERIOR_B_STATUS.md`; review-only `CONCEPTS.md`, `capture.mjs`, `perf.mjs`, `serve.mjs`, `index.html`, `concept-a.png`, `concept-b.png` and `verification-summary.json` under `review/exterior-visual-upgrade/`. No review PNG is loaded by the actual website.

The visual pass is ready for review. The one-time mesh-build pause and the remaining material gap from concept art are explicitly unresolved; this is not marked as production-ready.

## Connection-resume verification, 2026-10-13

At the user's request, no implementation was repeated and no new visual changes were made. Branch and implementation commit were rechecked; the runtime exactly matches `330e5ff` and the final SHA-256 above. Syntax checks for the worker and review tools passed. All five saved performance runs and nine saved lifecycle cases contain no unexpected console errors; integration guard and disposal assertions remain satisfied. The interrupted local HTTP check was completed after restarting the local server: gallery, concept image and final screenshot return HTTP 200, and the served worker hash matches the verified source. Only this report and the compact `verification-summary.json` were committed afterward. No merge, push or deployment.
