# Pastel Harbour

A small town builder in the browser, in the spirit of Townscaper. Click the water to lay a cobbled street;
click a street or a house to build on it. The town works out the rest: roofs, windows, doors, arches,
stairs, balconies, shopfronts, lamps, trees, washing lines across lanes, boats at the quays. It re-plans
itself around every click.

Built with Three.js and plain ES modules. No game engine, no image assets: every brick, tile and ripple is
generated.

## What's inside

- **An organic grid.** A hexagon of triangles is paired into quads, subdivided and relaxed toward squares.
  Houses sit on the grid's corners (Townscaper's dual grid), so walls, roofs and arches follow the irregular
  cells.
- **A scene planner.** Each rebuild reads the town (street tiles, house types, what every wall faces, the
  walking network) and places details from a registry of feature rules. Every placement has a reason, and a
  validator checks them.
- **Procedural geometry.** Instanced bricks, painted tile and stone materials, cut-out windows with rooms
  behind them, voxel ambient occlusion and ink outlines.
- **Feel.** Pieces grow on springs, and neighbours reshape in a wave from the click. Streets splash into the
  water and send ripples out. The camera frames the town as it grows. Day, dusk and night.

## Running it

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # dist/index.html, a single self-contained file

## Developing

    npm run check            # lint, tests and build
    npm test                 # fixture digests, planner rules, feature registry, performance budget
    npm run fixtures:update  # re-record the geometry fixtures after an intended change

The code layout, conventions and verification steps are in [CLAUDE.md](CLAUDE.md). Design notes and the
roadmap are in [ARCHITECTURE.md](ARCHITECTURE.md), and the history of each round of work is in
[MILESTONES.md](MILESTONES.md).
