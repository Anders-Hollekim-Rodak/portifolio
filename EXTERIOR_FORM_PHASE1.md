# Concept B — Phase 1: form and camera

This is the current Codex handoff. It supersedes the older visual-assessment wording in EXTERIOR_B_STATUS.md: **Concept B is the design reference to match, not loose inspiration.** The user approved only form and camera in this pass. Materials, lighting and animation design must wait for explicit Phase 1 approval.

## Isolation and starting state

- Branch: `feature/exterior-b-form-camera`.
- Worktree: `C:/Users/ander/OneDrive/Skrivebord/Portifolio/verification/exterior-b-form-camera`.
- Started from Codex's verified `6e61372`, not Claude's later worktree or session.
- Root `main` was clean at `11e0c10` at the start. The prior Codex worktree was clean at `6e61372`.
- This new branch/worktree was created for this phase. Other worktrees were only inspected; no merge, push, deployment or publication occurred.
- At the 2026-10-15 resume check, HEAD was still `6e61372`; the implementation and all review outputs were present as uncommitted work. The runtime checksum exactly matched the final collected evidence. All unfinished changes were preserved.
- The final local checkpoint is recorded below. Use `git log -2 --oneline` and `git status --short` in this worktree to identify the latest documentation commit.

## Runtime change

Only `loading-living-worker.js` changes runtime behavior.

- Replace the straight wall belt with a fuller orb profile and a deeper rounded underside.
- Shape two large directional folds from the entrance toward the tower; blend the tower foot into the lower silhouette.
- Narrow and reposition the tower; introduce a flared, tilted eave and a concave leaning needle spire.
- Place two slender front lancets and three staggered tower windows to match the concept's hierarchy. These are exterior placements; the room windows were not moved.
- Blend the nested Gothic porch into the curved body. Its exact passage, aperture and curtain geometry are retained.
- Curve the landing left, with a thin rim and curved underside. The original straight x=0 walk remains on the landing with a minimum 0.229 world units (about 0.93 m) of side clearance.
- Match the reference composition with a longer lens, a slightly elevated frontal three-quarter view, and responsive horizontal margins.
- Adjust the small floating core's size/position to match the still composition.

Geometry and camera mapping changes also update window-coordinate calculations and the landing lip's position in the existing shaders. There is no redesign of material colors, currents, reflectance, lighting, textures or animation timing. The material/light/animation block regression check verifies those unchanged sections.

## Form/camera reference

- Source image: `review/exterior-visual-upgrade/concept-b.png`; the left main view is the comparison target.
- Review frame: 1024 x 1024, DPR 1, animation time 8.05 s (the inherited breathing cycle is near rest).
- Eye: `[2.37, 1.73, 11.25]`; target: `[-0.02, 0.12, 0.03]`; vertical FOV: `0.378` radians at square/landscape ratios.
- Portrait FOV widens to retain margins; the whole exterior fits at 390 x 844 and 844 x 390.
- Main body radial scale 1.17; upper/lower pre-squash radii 1.26 / 1.48. Scale to room: 0.246 units/m, floor -0.78.
- Tower center `[1.35054, 0, -0.699624]`, nominal radius 0.35424, eave at y=0.9912, tip at y=2.1597, plus the authored lean and folds.
- Door contract unchanged: half-width 0.18204, sill -0.78, shoulder -0.47004, peak -0.15516, plane z=1.3161, passage back z=0.9102.
- Formation 6.6 s; approach 2.6 s; arrival 2 s; curtains 1.4 s; walk 5 s — unchanged.

## Visual assessment and remaining work

The main view now aligns the dome, spire, small core, entrance height and landing extent much more closely with the concept. The building has a rounded main mass, attached slender tower and a left-sweeping floating landing instead of the former frontal cylinder/straight slab arrangement.

This is a **Phase 1 review**, not a claim of complete visual equivalence. The folds are still more regular than the reference's sculpted ribbons, and the porch reads heavier in close-up. The lower shell and landing underside remain less delicately shaped. Confirm those forms with the user before moving on.

The largest remaining appearance differences are intentionally deferred: the existing glass is opaque-looking and line-patterned compared with the concept's deep cloudy teal glass; the doorway surround has a visible material boundary; highlights, warm window glow and violet rim separation do not yet match. Do not hide those differences in the comparison with grading or edited screenshots. No Phase 2 material/light work has been started. The inherited entry choreography is unchanged; only its starting camera moved.

The back-side inspection initially exposed a clipped-open fold. The new surface extended beyond the old meshing bounds. The field volume was expanded, projection steps were bounded, and a regression assertion now rejects any shell vertex reaching the volume boundary. The later captures show the closed surface. An earlier suspected triangle-orientation issue was not the primary cause.

## Verification

- JS syntax and `git diff --check` pass.
- `review/exterior-form/check.mjs`: exact aperture, passage, curtain geometry, timing and post-approach shared camera contract match 6e61372; material/light/animation blocks unchanged; finite meshes and 16-bit indices; no clipping at meshing bounds; walk clearance and four viewport bounds pass.
- Final shell: 55,415 vertices / 110,700 triangles; all uploaded meshes stay within the existing 16-bit index limit.
- Full lifecycle suite passed cold/warm entry, blocked input through entry, actual readiness, resource cleanup, fast/slow readiness, retry, degraded guard, mobile resize, reduced motion, missing OffscreenCanvas, missing gate, no room WebGL and missing modules.
- The lifecycle suite preceded the final mesh-boundary/porch-contact corrections. Those corrections changed only geometry construction; final-source invariant checks and actual integrated doorway captures were then repeated successfully. No event-flow files changed.
- Final screenshot capture reports zero console errors and zero warnings. Actual door reveal and final room entry were visually inspected.
- The first sandboxed Chrome attempt timed out at CDP Page.enable. Running the same local harness with approved browser execution succeeded; this was not a site failure.

## Files and artifacts

- Runtime: `loading-living-worker.js`.
- Review: `review/exterior-form/index.html`, `capture.mjs`, `check.mjs`, `perf.mjs`, `serve.mjs`, `evidence/*.png`.
- Handoff: this file; compact machine-readable results in `review/exterior-form/verification-summary.json`.
- Committed screenshots: `evidence/phase1.png`, `before-matched.png`, `entrance.png`, `threequarter.png`, `mobile.png`.
- Full local captures: `verification/exterior-form/before/` and `verification/exterior-form/final-v2/`.
- Lifecycle data: `verification/living-exterior/form-phase1-final/`.
- Invariants: `verification/exterior-form/invariants.txt`.
- Local review-page screenshots: `verification/exterior-form/review-page/`.
- Performance raw data: `verification/exterior-form/performance-*/performance.json`; initial native-camera pair under `verification/exterior-visual-upgrade/form-phase1-before/` and `form-phase1-after/`.

The verification directory is gitignored. Selected evidence and compact results are committed for continuation in another checkout.

## Exact commands

Run from this worktree, sequentially when measuring GPU cost:

```powershell
node --check loading-living-worker.js
node review/exterior-form/check.mjs
node tests/living-lifecycle-check.mjs --out=form-phase1-final
node review/exterior-form/capture.mjs --out=before --ref=6e61372 --preview-only
node review/exterior-form/capture.mjs --out=final-v2
node review/exterior-form/perf.mjs --ref=6e61372 --match-camera --out=performance-before-matched
node review/exterior-form/perf.mjs --out=performance-final
node review/exterior-form/perf.mjs --out=performance-final-repeat
node review/exterior-form/perf.mjs --ref=6e61372 --match-camera --out=performance-before-matched-repeat
node review/exterior-form/capture.mjs --out=review-page --review-page
git diff --check
node review/exterior-form/serve.mjs
```

Review: `http://127.0.0.1:8774/review/exterior-form/`.
Live isolated exterior: `http://127.0.0.1:8774/dev/living-exterior-preview.html`.
Actual readiness/entry: `http://127.0.0.1:8774/`.

The review compares both concept/current and previous/current from the same camera. Diagnostic views modify only served response bytes; integrated captures use untouched runtime source. No screenshot is a generated mockup.

## Continuation

Stop at Phase 1 review. Do not start material, light or animation changes until the user explicitly approves. Continue from this branch's latest checkpoint, not another agent's worktree. Keep the room, readiness, aperture and shared entry contract intact. Do not merge, push or deploy.

## Measured cost (2026-10-14)

Headless Chrome 155.0.8059.40, Intel Iris Xe / ANGLE D3D11, DPR 1. Fresh Chrome profile per command; desktop 1600 x 1000 then small viewport 390 x 844, 12.5 s of idle playback after seek(8.05). Two matched-camera pairs, second in reverse order. GPU query every approximately 30 drawn frames, 11–12 samples per case. These are local observations, not phone-hardware tests or production telemetry.

| Metric | Previous geometry, Phase 1 camera | Final Phase 1 |
| --- | --- | --- |
| Desktop GPU median, two runs | 3.47 / 3.32 ms | 3.95 / 4.20 ms |
| Desktop GPU p95 | 7.65 / 7.10 ms | 4.69 / 4.93 ms |
| Small viewport GPU median | 3.47 / 3.39 ms | 4.11 / 3.68 ms |
| Small viewport GPU p95 | 3.93 / 3.80 ms | 7.52 / 4.23 ms |
| Frame median | 33.4 ms | 33.4 ms |
| Frame p95 | 33.5 ms | 33.5–33.6 ms |
| CPU render median | 0.2 ms | 0.2 ms |
| Allocated triangles | 117,730 | 147,638 (+25.4%) |
| Instrumented idle draw calls | 13 | 13 |
| Desktop one-time shell/fittings build | 0.99 / 1.15 s | 1.90 / 1.53 s |
| Small viewport one-time build | 1.06 / 1.23 s | 2.72 / 2.04 s |

Actual draw submissions include one additional common halo draw in both versions. The renderer still targets 30 FPS; this is not an FPS improvement. At matched cameras the two pairs show about 14–26% higher desktop GPU median and 8–18% higher small-viewport GPU median. Do not treat these small samples as a precise performance guarantee.

An initial pair using each version's own camera measured 4.92 ms before versus 9.15 ms after on desktop. Later matched-camera runs were materially lower for both versions. Framing, shader warmup and machine state varied; that first result is retained in the raw artifacts and must not be cherry-picked as either a stable regression ratio or discarded as impossible. The final repeated runs above are the reproducible shape-cost comparison.

**Outstanding cost:** the one-time field mesh build is longer. This is CPU work in the existing worker; it does not change readiness or block page input by itself, but it can extend formation/startup. After form approval, consider prebuilding this exact mesh to eliminate the runtime field-meshing pause without reducing visual quality. That optimization was not introduced in this form/camera pass.

Final normalized runtime SHA-256: `ec4a23274b57ae2651612c63600843ed69c534819ef7e45e788eb1065e49a5e9`.

## Review completion (2026-10-15)

Resumed from the exact Phase 1 stopping point. No additional runtime/design changes and no test reruns were made during this completion step. Existing final screenshots, invariant results, lifecycle results and four matched-camera performance runs were inspected and retained. The comparison page now states the remaining form differences and links this handoff. The local review server on port 8774 returned HTTP 200.

## Saved checkpoint

- Implementation, comparison page, selected evidence and collected verification results: `68fb6bf60cabcba204699e4d2801ccdf108b834c` — `Match Concept B exterior form and camera for Phase 1 review`.
- The subsequent documentation-only commit records this checkpoint; runtime source and evidence are unchanged.
- Working tree was clean after the implementation commit. All Phase 1 changes were preserved in the isolated branch. Local raw verification output remains gitignored and available in this worktree.
- Review is now waiting for user approval. No Phase 2 work is authorized by this checkpoint.
