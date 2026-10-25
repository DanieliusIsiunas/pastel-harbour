# Pastel Harbour — milestones

Goal: a Townscaper-like town toy with comparable polish, running in the browser (Three.js, one HTML file).

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

- [x] **M0 Prototype** — square grid, boxes, auto roofs/windows/doors, arches (v1, `pastel-harbour.html`).
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

Open `index.html` through any static server, for example:

    python3 -m http.server 8000

then visit http://localhost:8000. In the browser console, `harbourView(x, y, z, tx, ty, tz)`
moves the camera, and `harbourAO(false)` turns ambient occlusion off for comparison
(the ink outlines reuse the occlusion pass's buffers, so they are desktop-only too).
`harbourStats()` reports blocks, houses, doors and how many pieces are still rippling. (The file is written without `<!doctype>`/`<head>` because it is
also published as a claude.ai artifact; browsers render it fine.)
