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
- [ ] **M5 Corner-based tiles** — move from cell-centred blocks to Townscaper's vertex-centred
      (dual-grid, marching-cubes) placement so building silhouettes get rounded corners.
- [ ] **M6 Terrain extras** — stairs between levels, roof gardens, walls/fences on enclosed ground.
- [ ] **M7 Sharing** — encode a town as a short link code; photo mode.
- [ ] **M8 Performance** — chunked rebuilds and mobile tuning for very large towns.

## Running locally

Open `index.html` through any static server, for example:

    python3 -m http.server 8000

then visit http://localhost:8000. (The file is written without `<!doctype>`/`<head>` because it is
also published as a claude.ai artifact; browsers render it fine.)
