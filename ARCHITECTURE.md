# Pastel Harbour — architecture review and roadmap

Goal: make it cheap to keep polishing details, look and feel, and performance.

## Where we are (measured 2026-10-26)

- One file, `index.html`: 2,791 lines, 95 top-level functions, 154 top-level `let`/`const`.
- Geometry is emitted through hidden global state: the current mesh `M` (9 reassignments), the
  surface kind `KIND` (23 writes), the openings list `OPEN` (13 uses). Emitters only work if these are
  set correctly beforehand.
- Randomness: 68 `hash(...)` calls with hand-picked salt numbers. Two features can silently share a
  salt and become correlated; nobody can tell which number controls what.
- Tunables: about 1,650 decimal literals inline (sizes, heights, probabilities, colours). Only `STYLES`
  and the rule tables are data.
- `emitFacade` branches 18 times on the planned feature or house type; adding a feature means editing
  the middle of a long function.
- Rebuild of a 514-block town (instrumented, three runs): **133–173 ms** per click.

  | stage | ms |
  |---|---|
  | geometry emission (all ~2,000 cell-levels) | 41–65 |
  | change signatures | 15–19 |
  | buffer + normal creation | 13–19 |
  | voxel AO field | 10–21 |
  | planner | 2 |
  | houses | 1 |
  | copying, picking, trees, ripple setup (unattributed) | ~40 |

  A click changes about 10 cell-levels, yet all ~2,000 are regenerated, signed and copied.
- No tests, no fixtures, no visual regression. Every check so far was manual screenshots.
- Testing needs a running browser; nothing can be checked in Node.

## Status (2026-10-26)

Changes 1–3 are done, with the fixture part of 6. It was one behaviour-preserving pass: the five
fixture scenes produce the same geometry digest as before the restructuring, and they exercise all
14 feature kinds.

    index.html            dev shell (Vite entry)
    src/core/             palette, util, grid, model (blocks), target (build targets), dims, env — no three.js
    src/plan/             houses, analysis (tile, side and house contexts), styles (house-type
                          vocabularies), planner (runs the registry's rules, validator)
    src/features/         one module per feature: door, stairs, shop, hoist, balcony, woodpile,
                          barrels, ivy, tree, laundry, lamp, waterStairs, fishingBoat, bench, boat; index.js is the registry
    src/geom/             builder (explicit target: mesh buckets, surface kind, openings, pick sink),
                          rules (geometry predicates), buildings, ground, boats (lofted hulls)
    src/render/           stage, materials, voxels, town (rebuild, chunks, ripple), time, post
    src/fx/  src/app/     particles, sound, life; input, picking, ui, history, dev helpers, main loop
    fixtures/             scenes.js and baseline.json (geometry digests)

- **Builder:** every geometry function takes `bld` first (`makeBuilder(mesh, pick)`); `bld.kind` is the
  surface kind, `bld.open` the openings on the wall being decorated. There is no module-global mesh state.
- **Feature module:** `{ kind, slot, phase?, rule, check?, draw(bld, ctx) }`. Slots: `side` (wall sides,
  drawn in the facade phase `entry`, `front` or `window`), `overlay` (foot of a wall), `node` (open
  tiles), `edge` (quay edges, `replacesRailing` if it takes the railing's place in its own cell, `clearsEdge`
  if the whole edge must stay open, as for a boat moored alongside; draw gets the edge's `v` and `n`), `boathouse`. Rule
  order is registry order.
- **Grid versions:** `GRID_VERSION` in `core/palette.js` names the grid generator. Saves record it, and
  `app/history.js` moves a town saved on an older grid to the current one by position. Changing grid
  generation means bumping the version and re-recording `fixtures/baseline.json`.
- **Pure core (change 2): done.** `src/geom/town.js` plans and emits the whole town as plain data. The
  renderer turns it into meshes, and tests run it in Node. ESLint stops core, plan, features and geom from
  importing render, fx or app.
- **Quality gates (part of 6): done.** `npm run check` runs lint, tests and the build; a pre-commit hook
  runs lint and tests. The tests cover fixture digests, planner rules on fixtures and 8 generated towns,
  registry completeness and a performance budget. Visual regression with Playwright is still to do.

Workflow: `npm run dev` (hot reload at http://localhost:5173), `npm run build` (writes
`dist/index.html` and `dist/artifact.html`, the single file published as the artifact). To check that a
refactor moved nothing, run `npm test`; the fixture digests are computed in Node by `fixtures/driver.js`.

## The six changes, most impactful first

### 1. Modules plus a dev server with hot reload (the foundation)
Split the file into ES modules and run them with Vite: instant reload on save, source maps, real
imports. A build step (`vite-plugin-singlefile`) still produces one self-contained HTML file for the
artifact.

    src/
      core/      grid.js  rng.js  model.js (blocks)  tuning.js
      plan/      analysis.js (tile, house, side contexts)  rules/*.js  planner.js  validate.js
      geom/      builder.js  shapes.js  walls.js  roofs.js  ground.js  features/*.js
      render/    materials.js  shaders/*.glsl  pipeline.js  water.js  sky.js
      fx/        ripple.js  particles.js  sound.js
      app/       input.js  ui.js  persistence.js  main.js

**Unlocks:** everything below; HMR on shaders and rule tweaks; parallel work on separate files.

### 2. A pure core separated from Three.js
`model → analysis → planner → geometry (plain typed arrays) → render adapter`. Only `render/` imports
three. Geometry output is plain data: positions, colours, kinds, brick instances, pick triangles.

**Unlocks:** running the planner and geometry in Node for tests (6), in a Web Worker (4), and
caching per chunk (4).

### 3. An explicit builder and a feature registry instead of globals and if-chains
- `builder` object passed to every emitter: `b.quad(...)`, `b.box(...)`, `b.blob(...)`, `b.surface('brick')`,
  `b.opening(rect)`. No `M`, `KIND` or `OPEN` globals.
- Each feature is one module: `{ kind, rule: {at, ctx, types, max, p, spacing, needs, claims, why}, draw(builder, slot, ctx) }`.
  The planner reads the rules; the facade, ground and roof emitters look up `draw` by kind.
  Adding a feature becomes adding a file.

**Unlocks:** variety at scale (dozens of features without touching core code), per-feature tests,
per-feature enable/disable for debugging.

### 4. Incremental rebuild with a dependency-aware chunk cache (and a worker)
- Cache geometry per cell-level, keyed by the inputs that actually affect it: the occupancy of the
  cell's corners and their neighbours, plus the plan slots and house traits of the houses touching it.
- On a click: re-run analysis and planner (2–3 ms), diff the plan and house traits, mark only the
  cells whose inputs changed, re-emit those, and patch their region buffers. The change detection
  that the ripple currently does by hashing whole outputs becomes free.
- Move emission into a Worker; transfer buffers back.

**Expected:** about 133–173 ms per click down to roughly 10–20 ms, edits never block a frame, and the
ripple shows exactly what changed.

### 5. Named random streams and a central tuning file with a live panel
- `rng(entity, 'window.shutters')` instead of `hash(a, b, c, 23)`: readable, collision-free, and a
  per-feature reseed is possible.
- `tuning.js` holds every look-and-feel constant (sizes, probabilities, colours, lighting presets,
  post-processing strengths), grouped by area. A small `lil-gui` panel in dev builds edits them live
  and triggers a rebuild or a uniform update.

**Unlocks:** tuning the look in seconds instead of edit–reload–navigate cycles; exportable presets.

### 6. A quality harness: fixtures, rule tests, visual and performance regression
- **Fixtures:** named scenes (one of each house type, a lane, a plaza, a quay with stairs, a bridge,
  stilts, an aqueduct) built through the same API as `harbourDev.build`.
- **Rule tests (Node, Vitest):** run the planner on fixtures and assert the validator finds no issues,
  plus targeted rules (no door into water, every water stair has a boat, balconies only over open space).
- **Visual regression (Playwright):** render each fixture from fixed cameras, day and night, and diff
  against approved screenshots. Polish changes are then reviewed as image diffs.
- **Performance budget:** a scripted benchmark (rebuild ms, frame ms at fixed views, triangle and draw
  counts) that fails when a change exceeds the budget; an in-game perf HUD in dev builds.

**Unlocks:** safe, fast iteration; regressions are caught by a machine, not by a screenshot review.

## Suggested order

1 → 2 → 3 happen together as one restructuring pass, preserving behaviour (checked with fixtures from 6).
Then 6 (harness), then 4 (incremental and worker), then 5 (tuning panel). After that, every polish
round is: change a rule, a feature module or a tuning value, see it hot-reload, and let fixtures and
image diffs confirm nothing else moved.
