# Exterior sculpt continuation — local checkpoint

2026-11-03. Branch `feature/exterior-b-form-camera`, worktree `verification/exterior-b-form-camera`, starting commit `37fd68d`.

The wizard-hat roof is implemented and checked: wider undulating brim, fuller crown, tip bent toward the dome. This maps 5,016 existing roof vertices once during construction. Topology, 147,638 total triangles, materials, camera, entrance, room and platform are unchanged. Source SHA-256: `d77e49afa588ffdfc739f2be750f8224b1fb7bdeba2a6c71538868e595e857e4`.

Checks: runtime syntax; roof source/mesh/framing guard; full standalone and integrated entry captures (zero console errors/warnings). Close-up before/after use identical cameras. All four framing sizes pass. The inherited tip overlap and brim tessellation remain visible at extreme magnification.

Evidence: `verification/exterior-form/wizard-hat-v1/`, `wizard-hat-detail/`, `wizard-hat-before/`; geometry `verification/exterior-wizard-roof/check.json`; A/B/B/A benchmark `verification/exterior-correction/wizard-hat-paired/performance.json`. All benchmark samples retained ~30 fps, CPU median .2 ms. GPU desktop medians before 8.006/9.670 ms vs after 10.739/7.696; narrow before 6.487/6.510 vs after 6.545/6.558. No consistent desktop regression; narrow difference <1%. Build times varied 1.3-2.8 s; isolated roof mapping in the VM guard cost 164 ms (diagnostic environment, not a browser startup measurement).

The user has now clarified an additional authorized change: give the building's left side similar fluid folds to its right, and smooth the hard transition at the doorway. That work is next; preserve this verified roof and the existing entry/platform/materials. No merge, push or deployment. Final comparison page and handoff will cover both changes, then stop for approval.
