# Pastel Harbour — milestones

Goal: a Townscaper-like town toy with comparable polish, running in the browser (Three.js; ES modules built into one HTML file).

## What makes Townscaper feel the way it does (research notes)

- **Organic grid.** A hexagon is filled with triangles, random pairs of triangles are merged into quads,
  every polygon is subdivided into quads (centroid + edge midpoints), vertices are welded, then the mesh
  is relaxed so every quad tends toward a square. Result: an irregular grid where every cell is a quad.
- **Deformed tiles.** Pieces are authored in a unit square and bent onto each irregular cell
  (bilinear mapping of the four corners), so walls, roofs and windows follow the cell shape.
- **Neighbour rules.** The player only toggles filled/empty cells. Every visual decision (roof type,
  ridge direction, windows, doors, arches, gardens) is derived from the neighbours on each rebuild.
- **Atmosphere.** Soft sky gradient, fog, soft shadows, foam around the shore, gentle water, glowing
  windows at night, sound that rises in pitch with height.
- **Feel.** Squash-and-stretch on placement, instant feedback, never a failure state, undo.

Sources: Oskar Stålberg's 2019 Twitter threads on the grid; the Sylves "Townscaper grid" tutorial
(boristhebrave.com); Game Developer, "How Townscaper works".

## Milestones

- [x] **M0 Prototype** — square grid, boxes, auto roofs/windows/doors, arches (v1; removed from the tree, see git history).
- [x] **M1 Organic grid** — hex → triangles → random quad pairing → subdivision → square relaxation;
      cells, adjacency, point-in-cell picking; all geometry bilinearly deformed onto cells.
- [x] **M2 Architecture rules** — gable roofs that join along rows, flat roofs with parapets for
      blocks, pointed spires on lone towers, arcades under floating blocks, doors with steps and lamps,
      window variety scaled to wall length, balconies, chimneys, courtyards with grass and trees, shore foam.
- [x] **M3 Atmosphere** — gradient sky, fog, day / dusk / night, lit windows with bloom, waves,
      contact shading at the quay, vignette.
- [x] **M4 Feel** — pop animation, pentatonic plucks by height, ambient sea, cursor-local grid reveal,
      cell-shaped hover ghost, undo/redo, gulls and boats.
- [x] **M5 Corner-based houses** — houses now sit on grid corners (Townscaper's dual grid). Each cell
      draws the quarter of every house around it: half-walls on the cell's midlines, rounded outer
      corners (a per-house trait: crisp, soft or round), lone towers become round with conical spires.
      Roofs are hip roofs built as a fan from each house corner, so neighbours share one continuous
      ridge; inner cells of big blocks become roof terraces. Floating houses get smooth arches whose
      crown sits on the shared joint, so two cells form one arch. Windows, doors and dormers are
      centred on the same joints and drawn as two matching halves.
- [x] **M6 Ground and roof life** — quays that follow the building outline with foam, door steps
      down into the water, lamp posts on rounded quay corners, enclosed courtyards with trees or a
      well and flowers, roof gardens and planters on terraces, chimneys, dormers, shopfronts with
      striped awnings, balconies. Roof colours are grouped into small regions so rows read as buildings.
- [x] **M6b Gables and stairs** — lone cottages and the last house of a row get gable ends (the wall
      rises into a triangle under a verge, with an attic window); two-storey houses sometimes get an
      exterior staircase from the street to a first-floor door with a landing and railing.
- [x] **M6c Streets first** — level 0 is now a cobbled street layer laid on the water (quay walls,
      kerbs, foam, lamp posts on rounded corners). Houses are built on streets, doors prefer to face a
      street, and an open street tile hemmed in by houses becomes a garden with a tree or a well.
- [x] **M6d Nothing levitates** — any floor with nothing directly under it gets arches and piers that
      reach down to whatever is there: the floor below, the street (arcades over lanes), or the sea
      bed (bridge piers with stone footings in the water).
- [x] **M9 Roof craft** — tile courses on every slope (parallel to the eave), ridge and hip caps on
      the lines where facets meet, chimney pots. Goal: roofs read as built from tiles, not flat planes.
- [x] **M10 Facade articulation** — cornice moulding under every eave, a floor band between storeys,
      window heads and the odd pediment, shutters in their own colour family. Goal: storeys and
      buildings read at a glance, walls stop looking like flat coloured slabs.
- [x] **M11 Tiered arcades and water stairs** — when a floor spans more than one storey of empty space
      the piers carry an arch at every storey (aqueduct); open quays get stone steps down into the water.
- [x] **M12 Soft ambient occlusion** — screen-space GTAO so creases (roof meets wall, wall meets street,
      under eaves and arches) darken softly, the way Townscaper's renders do.

### Visual parity round (reference: two Townscaper screenshots; goal is the hand-made, Ghibli-like warmth)

- [x] **P1 Painted materials** — walls read as brick, roofs as tiles, quays as cut stone, each brick or
      tile slightly different in tone, drawn in the shader from world position (no image files).
- [x] **P2 Ink outlines** — thin dark lines on silhouettes and creases, like the reference's inked look.
- [x] **P3 Clear water** — semi-transparent water with soft reflections, a sandy shelf around the quays
      seen through it, a darker sea floor, and foam that hugs the shore.
- [x] **P4 Light and grade** — filmic tone mapping, warm key and teal fill, teal haze; roofs from a
      sand-and-terracotta family; each building keeps one colour as it grows.
- [x] **P5 Quay character** — red brick coping on quay edges, iron railings on open edges,
      small cross-barred windows that make buildings feel larger.

### Regeneration round (the town re-plans itself around every click)

- [x] **R1 Houses** — adjacent columns of the same colour group into house-sized units. Each house
      owns its traits: roof colour, window family, head style, shutters, one main door facing a
      street, shopfront or not, chimney positions. Decisions are anchored to the house, so a click
      only re-plans the house it touches.
- [x] **R2 Facade composition** — window types stack vertically floor to floor and follow the
      house's family; blank walls and balconies line up; shops fill a house's street frontage.
- [x] **R3 Role reinterpretation** — a tall lone tower turns into a lighthouse with a gallery and a
      glowing lantern; a house's door moves when a neighbour covers its old street side.
- [x] **R4 Visible regeneration** — every piece of the town that changed because of a click animates,
      rippling out from the click, not just the new block.

### Feel round

- [x] **F1 Living motion** — new pieces grow from a point on a damped spring (stretch, overshoot,
      settle) with a warm glow as they land; reshaped neighbours dip and rebound in a wave that
      travels out from the click; dust puffs and golden sparkles; rings on the water when a street
      is laid; a rising cascade of notes with the wave, a chime on landing, a soft poof on erase;
      the hover preview breathes. Honors prefers-reduced-motion.

### Next-level round (techniques from Tiny Glade and Townscaper)

- [x] **N1 Real bricks** — walls are covered in individually placed, instanced bricks with chamfered
      edges, each slightly proud of the wall by a random amount and tinted on its own; quay walls get
      big cut stones. The light catches every edge (Tiny Glade's approach).
- [x] **N2 Cut-out windows** — windows are holes cut through the wall with the stencil buffer, showing
      a small room behind; at night the rooms glow (Townscaper's approach).
- [x] **N3 Soft shading** — a blurred 3D occupancy field of the town darkens alleys and lower floors
      smoothly and never flickers; screen-space contact shadows toward the sun add crisp detail.
- [x] **N4 Junction details and supports** — drainpipes where two house colours meet on a facade,
      quoin stones on crisp corners, and iron stilt frames with bracing as an alternative to arches
      for floors that overhang open water.

### Logic and life round (every detail needs a reason)

- [x] **L0 Scene planner** — once per rebuild, the planner analyses the scene: each street tile is a
      lane, plaza, courtyard or quay; each house is a cottage, townhouse, tower or warehouse; each wall
      side knows what it faces (a street kind, water, a roof below, open air over a street or water).
      A declarative rule table then places features: each rule states where it may go, what it needs,
      how many a house may have and how far apart they must be. Slots are reserved so features never
      collide, every placement records its reason, and a validator re-checks the result
      (`harbourDev.plan()`, `harbourDev.why(vertex)`). Drawing code only draws the plan.
- [x] **L1 Access logic** — doors only open onto walkable ground; exterior stairs need a street at the
      foot and claim the first-floor side for their top door; balconies only overlook open space.
- [x] **L2 Purposeful water edges** — water stairs are spaced along quays and always have a rowboat
      moored at the bottom; a street-level floor over open water becomes a boathouse with a boat.
- [x] **L3 Greenery** — ivy grows as vines from roots between windows and steers around openings;
      potted shrubs flank doors of houses that like planters; trees in planters on open plazas; pots on
      balconies.
- [x] **L4 Street life** — lamps spaced along quays and plazas, benches on quays facing the water,
      crates of produce outside shops, laundry across lanes between two facing tall houses.

- [x] **L5 House-type vocabularies** — a house's type is read from its whole building mass
      (cottage, townhouse, tower, warehouse) and each type has its own vocabulary in one table
      (`STYLES`): door style (plank, panelled with fanlight, arched with iron straps, barn with a Z brace),
      window proportions and heads, shutters, flower boxes, balconies, gable tendency, dormers,
      chimneys, roof palette (warm tiles, sand, slate, copper green), planters and ivy. Type-specific
      rules add warehouse hoists with loading doors, barrels outside warehouses, woodpiles against
      cottages, and round windows near the tops of towers.

### Ergonomics round (building should feel predictable)

- [x] **E1 What you see is what you build** — the water grid now outlines build targets (each corner's
      footprint: edge midpoints and cell centres) instead of the cells, so the patch you aim at is the
      patch that fills. Water clicks pick the footprint under the cursor exactly, instead of the nearest
      corner. Near a cell centre, where four footprints meet, a click prefers the one that joins a
      street along a side, so a line of clicks becomes one connected street. A click builds exactly what
      the hover preview showed. Measured on straight sweeps across the board, tiles that only touched a
      neighbour at a corner dropped from 11.7% to 1.2% of clicks.
- [x] **E2 Even targets** — the grid pairs triangles fewest-options-first, so almost none are left
      single, and relaxation pulls every quad toward one common size. 5th–95th percentile target area
      spread went from 3.8× to 2×, irregular corners from 149 to about 60, and quads are squarer
      (median smallest angle 70° → 75°). Saved towns move to the new grid by matching each old corner to
      a nearby new one.

### Real-life logic and light round

- [x] **W1 Walkway-aware props** — the planner builds the walking network: open tiles joined along their
      sides, with route tiles (tiles the network splits without: lanes, piers, necks between squares) and
      tiles in front of doors, exterior stairs and water stairs. Trees stand only where the street has
      room to spare: the middle of a square that is open on every side, or the water side of a wide quay
      that isn't the only way through. Lamps stand at the kerb, on the side of the path rather than in
      it, or hang from a bracket on a house wall beside the window; a free post only in an open square.
      Benches keep clear of doors and stairs. The validator reports a tree on a walkway, a bench in front
      of a door, or a lamp with nowhere to stand. `harbourDev.walk()` reports the network and each
      lamp's spot.
- [x] **W2 Soft light** — one darkening budget instead of five stacked effects. AgX tone mapping replaces
      ACES (with a saturation lift so the palette keeps its colour), a warm sand-coloured bounce light
      replaces the dark teal underside light, and screen-space AO, contact shadows and the voxel AO
      floor are softened. Ink lines are now a deeper shade of the surface they sit on, not near-black.
      Grout, railings and drainpipes are lighter. Measured with `harbourDev.shading()` on the default
      town, wide view, day: near-black pixels 7.2% → 0.02%, dark-sharp pixels 6.6% → 0.66%, mean
      luminance 0.38 → 0.55, saturation 0.43 → 0.40. A Townscaper screenshot measured 2.6%, 4.6%, 0.47
      and 0.45.

- [x] **D1 Lanes that connect** — two tall houses facing each other across a lane now share a span,
      chosen per lane so each kind gets its share: a washing line from window to window with shirts,
      trousers, towels and socks on pegs; bunting high under the eaves; a string of bulbs that glows at
      night; or, over a narrow lane, a stone tie arch at the first-floor line bracing the two walls.
      Spans keep their distance from each other as one group (`group: 'span'` in a rule), and all share
      one helper (`features/span.js`) that finds the facing walls.
- [x] **D2 Shop signs** — shopfronts hang a blade sign on an iron bracket past the awning, in the
      awning's colour, with a gilded emblem (a loaf, a fish or a bottle) that reads from along the street.
      Dev helpers: `harbourDev.find(kind)` lists where a feature went, and `harbourDev.look(kind, i)` frames it.

- [x] **D3 Water that answers** — a street dropped into the harbour throws up a ring of droplets from
      its edge that arc and fall back, and sends a train of ripples out through the water itself (in the
      water shader, up to eight at once). The crests bend the reflection, catch the light, and carry a
      torn band of foam, with a fainter line on the crest behind. The waves stretch out as they travel and
      fade over three seconds. Removing a street lets the water close in with a smaller splash. The flat
      white rings and the dust puffs on water are gone. `harbourDev.rippleAt(v, age)` freezes a ripple for
      inspection, and `place(v, y)` / `remove(v, y)` act exactly like clicks.

- [x] **C1 Camera director** — the camera frames the town the way Townscaper's does. An empty
      harbour starts close, and every build re-fits the view. Framing projects the town's silhouette
      (each column's footprint corners at the waterline and at the roof) into the current view and solves
      the distance at which all of it lands on screen, so a wide, low town fills a landscape screen and a
      phone in portrait still sees the full width. The camera eases out quickly when the town grows
      (pieces never leave the screen) and eases back in slowly when it shrinks; small changes are
      ignored. Above all the camera holds still: building inside the view moves nothing. It steps back
      only when the town no longer fits (with 12% headroom, so the next pieces don't move it again), and
      comes in only once the town needs under 70% of the view. The same rule runs after an orbit ends,
      never during one. The eye sits about 24° above the horizon, and the town fills about 80% of the
      width and 70% of the height. The player stays in charge: orbiting is untouched, zooming zooms
      toward the cursor and is kept as a multiplier on the framing, and panning is kept as an offset.
      When zoomed in on a corner, the camera stays there and follows a new piece that lands near the
      screen edge. Measured: the framing distance goes from 6.6 (empty) to 9.2
      (six streets) to 13.3 (a five-storey tower) to 30 (a 406-block town, 1280×800). `harbourDev.camera()`
      reports the framing, and `harbourDev.auto()` hands the camera back after `harbourView`.

### Engineering round

- [x] **Q1 Quality gates** — `CLAUDE.md` sets the conventions and workflow for agentic work. ESLint covers
      bugs and layering: core, plan, features and geom may not import render, fx or app. Vitest runs 80
      tests in about 2 s: fixture digests (computed in Node, identical to the browser's), planner rules on the
      fixtures and 8 generated towns (validator clean, doors onto open ground, no trees on walkways, every
      lamp and span placed), feature registry completeness, and a performance budget (406-block town planned
      and emitted in under 200 ms, triangle, brick and pick budgets). `npm run check` runs lint, tests and
      the build; a pre-commit hook runs lint and tests. Lint found and fixed a real bug: a local `C` (the
      cell centre) shadowed the palette in the street code, so quay stone and street foam silently took the
      grout colour.

### Polish round: no flicker, no odd forms

- [x] **Z1 Depth precision** — the camera's near plane follows the viewing distance (a tenth of it, at
      least 0.1) and the far plane sits just past the sky. At the usual distance the depth buffer is about
      40 times finer, so details a few millimetres off a wall (bricks, window masks, frames) stop flickering.
- [x] **Z2 No tied faces** — a detector (`npm run zfight`, `src/geom/overlap.js`) finds faces that share a
      plane, face the same way and look different. In the default town these went from 40,312 pairs (14% of
      triangles) to 1,224 (0.4%, mostly overlapping ivy leaves). The fixes are systemic: upper walls start
      at their floor line instead of overlapping the wall below, wrapping runs are lifted by their
      direction (`band`), every box gets a hair-width skin chosen from its own position and size,
      glazing bars cross at different depths, railing posts stop under the rail, and leaf clumps vary in
      size and depth. A test keeps ties under 0.6% of triangles.
- [x] **F1 Whole forms** — details centred on a joint between two cells are decided from the length both
      halves share (`jointHalf`), so a dormer, window, door or shopfront is drawn whole or not at all;
      before, a half whose wall rounded a corner could skip while the other half drew. Exterior stairs
      need straight wall on both halves of both floors. They are now built masonry: cut-stone steps closed
      by a sloped stringer wall with a coping and an iron handrail, and the landing on an arch between
      slim piers instead of a full-height block. Ivy, woodpiles and barrels keep clear of walls that a
      door, staircase or shopfront uses.

- [ ] ~~M7 Sharing~~ — skipped for now.
- [ ] ~~M8 Performance~~ — skipped for now (a full rebuild of a ~380-block town takes ~50 ms).

## Polish ideas for later

- More roles: covered bridges between houses, roof terraces with a door when a roof meets a taller wall,
  belfries, warehouses with wide doors for long low houses.

- Dormer and chimney variety, roof windows; corner quoins on crisp corners.
- Interior light spill on streets at night; window boxes that vary by colour family.
- String courses between floors, corner pilasters, door/window variety per colour family.
- Soft ambient occlusion where walls meet roofs.

## Running locally

    npm install
    npm run dev        # http://localhost:5173 with hot reload
    npm run build      # dist/index.html and dist/artifact.html (one self-contained file)

Code layout and the feature registry are described in ARCHITECTURE.md. In the browser console,
`harbourView(x, y, z, tx, ty, tz)` moves the camera, and `harbourAO(false)` turns ambient occlusion
off for comparison (the ink outlines reuse the occlusion pass's buffers, so they are desktop-only too).
`harbourStats()` reports blocks, houses, doors and how many pieces are still rippling.
`harbourDev` builds precise test scenes (`build([[vertex, level, colour]])`, `clear()`, `vertexAt(x, z)`,
`neighbors(v)`, `sample(seed)`, `time(name)`), toggles `bricks(on)` / `rooms(on)`, reports `count()` of triangles and
bricks, `plan()` and `why(vertex)` for the planner, and `digest()`, the geometry fingerprint the
fixtures in `fixtures/` are checked against. `walk()` reports the walking network, and `shading()`
measures darkness and harshness at fixed camera views.
