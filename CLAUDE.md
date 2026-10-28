# Pastel Harbour

A Townscaper-like town builder in the browser (Three.js 0.160, ES modules, Vite). The player clicks the
water to lay streets and stacks houses on them. Everything else (roofs, windows, doors, props, lights,
details) is planned and drawn procedurally. The quality bar is Townscaper and Tiny Glade: every detail needs
a reason, and the whole thing should feel hand-made.

Published build: https://claude.ai/artifact/WsQFg8A88Pt5uU5cvR8Z7o (publish `dist/artifact.html` to this URL
after any user-visible change).

## Commands

    npm run dev              # http://localhost:5173 with hot reload
    npm run check            # lint + tests + production build: run before saying a change is done
    npm run lint             # ESLint (bugs and layering, not formatting)
    npm test                 # Vitest: fixtures, planner rules, registry, performance budget (~2 s)
    npm run fixtures:update  # re-record fixtures/baseline.json after an intended geometry change
    npm run zfight           # list faces that share a plane and flicker (add --trace for the source lines)
    npm run build            # dist/index.html and dist/artifact.html (one self-contained file)

A pre-commit hook (`.githooks/pre-commit`, enabled by `npm install`) runs lint and tests.

## How the code is laid out

Data flows one way: **model → analysis → planner → features/geometry → render**.

| folder | what it holds | may import |
|---|---|---|
| `src/core` | grid, block model, build targets, palette, dims, util, sample towns | core |
| `src/plan` | houses, scene analysis (tiles, sides, walking network), styles, planner and validator | core, plan, features |
| `src/features` | one module per planned detail: rule, check, draw. `index.js` is the registry | core, plan, geom |
| `src/geom` | builder (mesh buckets), shared geometry rules, buildings, ground, `town.js` (whole town as data, digest) | core, plan, features, geom |
| `src/render` | stage, materials, water, post-processing, voxels AO, camera director, town meshes and ripple | anything |
| `src/fx`, `src/app` | particles and sound; input, picking, UI, history, dev console helpers, main loop | anything |

ESLint enforces the first four rows: core, plan, features and geom never import render, fx or app, and never
touch the DOM. That keeps them running in Node (tests) and movable to a worker later.

## Conventions

- **Systemic, not patched.** Fix the rule that produced a bad result, not the one case you saw. A new detail
  is a feature module with a rule that says where it goes and why. Don't special-case it inside a drawing
  function. Prefer real-world logic: doors open onto walkable ground, props keep off walkways, spans need two
  facing walls, and so on.
- **Adding a detail:** create `src/features/<kind>.js` exporting
  `{ kind, slot, phase?, rule: { ..., why }, check?, draw(bld, ctx) }`, add it to `FEATURES` in
  `src/features/index.js` (order matters: rules run in registry order), and give it a `check` if it can be
  placed wrongly. Slots: `side` (wall sides, facade phase `entry` / `front` / `window`), `overlay` (foot of a
  wall), `node` (open tiles; `group` shares spacing), `edge` (quay edges), `boathouse`.
- **Geometry** goes through the builder passed as the first argument (`bld`): `face`, `hexa`, `wb`, `wslab`,
  `boxAt`, `rod`, `blob`, ... `bld.kind` selects the painted material (0 plain, 1 brick, 2 tile, 3 stone,
  4 mortar); reset it to 0 after use. `bld.open` holds the openings on the wall being decorated.
- **No two faces in one plane.** Faces that share a plane, face the same way and look different flicker
  (z-fighting). Don't author a detail at exactly the depth or height of what it sits on. Runs that wrap
  around a building (bands, cornices, plinths, footings) go through `band()`, which lifts each run by its
  direction so corners never tie. `wb()` boxes get a hair-width skin automatically. Use
  `npm run zfight -- --trace` to find ties; a test keeps them under 0.6% of triangles.
- **Townsfolk** use what features tell them. A detail people would go to (a seat, a window, a mooring)
  records a `spot()` where it draws; anything standing on the ground in the way records an `obstacle()`.
  Errands are a rule table (`ERRANDS` in `src/plan/folk.js`) with a `why`, like the planner's.
- **Joint-centred details** (windows, doors, dormers, shops, balconies) are drawn as two halves by two cells.
  Decide what fits from `jointHalf(v, n, y)`, the length both halves share, so nothing is ever drawn half.
  It already leaves out strips that other dressing claims (quoins at crisp corners: `QUOIN_W`); a new
  corner or edge dressing must reserve its strip there too, and register openings in `bld.open` so bricks
  are cut around them. A test checks that no brick or quoin reaches into a window or door.
- **Randomness** is deterministic: `hash(a, b, c, salt)`. Pick a salt no other feature uses (grep for it)
  so features don't become correlated. Never use `Math.random()` in core, plan, features or geom.
- **Shared dimensions** live in `src/core/dims.js`; colours in `src/core/palette.js`. Keep the
  multi-colour pastel palette; the owner likes it.
- **Comments** explain why, in plain sentences, above the block they describe. Match the density of the
  surrounding code. No commented-out code.
- **No dead code or stray imports**: lint fails on unused names and on shadowing (a local named like an
  import is how a stale import hid a real bug before).
- Formatting: 2 spaces, LF, lines up to about 140 characters, dense code in the existing style. There is no
  formatter on purpose; don't reflow untouched code.

## Verifying a change

1. `npm run check` must pass.
2. If geometry changed on purpose, run `npm run fixtures:update` and say in the commit what moved and why.
   If it changed by accident, find out why before re-recording.
3. Look at it. In the dev page console, `harbourDev` offers: `sample(seed)`, `place(v, y)` /
   `remove(v, y)` (like clicks, with animation), `find(kind)` and `look(kind, i)` to frame a feature,
   `span(v)`, `walk()`, `plan()`, `why(v)`, `folk()`, `follow(i, state)`, `folkRate(k)` and `folkStep(sec)` for the
   townsfolk, `frame()` (draw one frame, e.g. while the pane is hidden), `time('Day'|'Dusk'|'Night')`, `rippleAt(v, age)` (frozen
   water ripple), `shading()` (darkness metrics), `camera()` and `auto()`, `digest()`. `harbourView(...)` takes
   the camera manually; `harbourDev.auto()` hands it back.
4. Lighting budget (default town, day, wide view, `harbourDev.shading()[0]`): near-black under 1%,
   dark-sharp under 1.5%, saturation about 0.4.
5. Frame rate: 60 fps on the default town with the browser pane visible. A hidden pane throttles animation
   frames, so timing numbers from it are meaningless.

Gotchas: anything that moves the camera after `controls.update()` must re-aim it (`aim()` in the director),
or the frame is drawn looking a step behind and the view shakes; `harbourDev.steerTest()` measures it.
The planner keeps module state (`PLAN`, `WALK`, houses); call `emitTown()` (or rebuild) before reading
it. Importing a source module from the console after hot reload can give a second copy of it; go through
`harbourDev` instead.

## Docs and commits

- `MILESTONES.md`: add an entry for each round of work: what changed, measured where possible.
- `ARCHITECTURE.md`: the code layout, decisions and the roadmap.
- Commit only when the owner asks. Author: `git -c user.email=12203807+DanieliusIsiunas@users.noreply.github.com -c user.name="Danielius Isiunas" commit`.
  Message: a short subject, a body listing what changed and why, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
