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
- [ ] ~~M7 Sharing~~ — skipped for now.
- [ ] ~~M8 Performance~~ — skipped for now (a full rebuild of a ~380-block town takes ~50 ms).

## Polish ideas for later

- Tiers of arches when a floor spans more than one storey of empty space (currently one tall pier).
- Steps down from the street into the water at some quay edges.
- String courses between floors, corner pilasters, door/window variety per colour family.
- Soft ambient occlusion where walls meet roofs.

## Running locally

Open `index.html` through any static server, for example:

    python3 -m http.server 8000

then visit http://localhost:8000. In the browser console, `harbourView(x, y, z, tx, ty, tz)`
moves the camera, which helps when inspecting details. (The file is written without `<!doctype>`/`<head>` because it is
also published as a claude.ai artifact; browsers render it fine.)
