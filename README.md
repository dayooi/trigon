# Trigon

A triangle block puzzle: drag pieces from the tray onto a hexagonal board of
triangles. Fill a complete line in any of the three grid directions and it
clears. Play until nothing in the tray fits any more.

No build step, no dependencies — plain ES modules, SVG and CSS.

## Running

ES modules need a server (opening `index.html` over `file://` will not work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it plays

- Drag a piece from the tray onto the board. The piece snaps to the nearest
  cell where it actually fits, so you don't have to be pixel-perfect.
- Pieces cannot be rotated — the tray gives you the orientation you get.
- A line is any full row or either diagonal. Clearing several at once, or
  clearing on consecutive drops, multiplies the score (up to 4x).
- Gems reward multi-line drops only. Clearing one line pays nothing; two at
  once pays 1 gem, and every further line in the same drop pays two more
  (0, 1, 3, 5, 7, ...). Gems accumulate across games; they and the best score
  are kept in `localStorage`.
- Keyboard: `p` pauses, `r` starts a new game.

## Code layout

| File | Role |
| --- | --- |
| `src/geometry.js` | The triangular grid: cell addressing, hit-testing, line groups |
| `src/shapes.js` | Piece definitions (polyiamonds) and the colour palette |
| `src/game.js` | Rules and state — placement, clearing, scoring. No DOM |
| `src/ui.js` | SVG rendering helpers for the board, pieces and ghost |
| `src/main.js` | Wiring: tray, drag & drop, HUD, overlays |

### The grid

Cells are addressed as `(r, p)`: `r` is the row, and `p` is twice the x
coordinate of the cell's left corner, which keeps both up- and down-pointing
triangles on integer addresses. Orientation is not stored — it falls out of
parity:

```
cell points up  <=>  (r + p) is odd
```

That invariant holds because consecutive horizontal lattice lines differ in
length by one, so their vertex offsets alternate.

Each cell belongs to exactly three lines, one per lattice direction, and a line
clears when every cell in it is filled:

| Key | Direction | Invariant |
| --- | --- | --- |
| `r<n>` | horizontal row | `r` |
| `a<n>` | diagonal, up-right | `p + r`, minus 1 for down-pointing cells |
| `b<n>` | diagonal, up-left | `p - r`, plus 1 for down-pointing cells |

A radius-4 hexagon (the default) has 96 cells in rows of 9/11/13/15/15/13/11/9
and 24 lines of 9 to 15 cells each.

### Pieces

A shape is a list of `[dr, dp]` offsets from its anchor cell plus the
orientation the anchor must have (`anchorUp`). Because orientation follows
parity, the offsets alone determine every other cell's orientation:

```js
cellIsUp = anchorUp === ((dr + dp) % 2 === 0)
```

To add a piece, append an entry to `SHAPES` in `src/shapes.js`; `weight` sets
how often it appears. Everything else — tray rendering, drag ghost, placement,
the "no moves left" check — works off that definition.

### Randomisation and difficulty

Each tray slot is an independent weighted draw from `SHAPES` — there is no bag,
no shuffle and no memory of what came before, so the same piece can appear
three times in a row. All three slots refill at once, only when all three have
been used.

`weight` is the difficulty dial. Small pieces fit almost anywhere and keep a
crowded board playable, so the mix decides how long a game runs. Measured with
a greedy solver over 300 games:

| Mix | avg cells | 1-2 cell | 4+ cell | moves/game | avg score |
| --- | --- | --- | --- | --- | --- |
| small-piece heavy | 2.90 | 35% | 26% | 53 | 1071 |
| current | 3.39 | 18% | 42% | 37 | 717 |

`REFILL_ATTEMPTS` in `src/game.js` is a second, much weaker dial: a refill
redraws up to that many times looking for a tray with at least one playable
piece. It reads like a big mercy but measures as noise (53 vs 54 moves with it
off), because a tray that fits nowhere is rare until the board is already
jammed. Set it to 1 to remove the safety net entirely.

### Tuning the look

Two values are coupled and must move together: `--cell-stroke` in
`styles.css` and `CELL_SHRINK` in `src/ui.js`. The stroke is drawn in the
cell's own colour with a round line join, so it does the corner rounding
(radius = half the stroke) and paints back over the shrink. Widening the
stroke without lowering the shrink closes the gaps between triangles;
lowering it without widening the stroke gives sharp corners.

Clearing a line animates colour only — `--fill` fading to `--cell`, never
transform — so the board reads as a fixed grid that a line vanishes from.
`--clear-ms` and `CLEAR_ANIM_MS` in `src/main.js` are the same duration.

### Adding features

- `window.trigon` exposes `{ game, SHAPES, syncBoard, syncHud, renderTray,
  restart }` for poking at a live game from the console.
- Board size is a single parameter: `new Game(radius)` in `src/main.js`.
- `game.place()` returns everything a feature needs to react to a move —
  cells placed, cells cleared with their colours, lines, points, gems and the
  current streak.
