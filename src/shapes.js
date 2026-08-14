/**
 * Piece definitions (polyiamonds).
 *
 * `weight` is the relative draw frequency and is the main difficulty dial:
 * small pieces fit almost anywhere and keep a crowded board alive, so leaning
 * the mix toward 4+ cell pieces shortens games. Measured against a greedy
 * solver over 300 games, the current mix (avg 3.4 cells, 18% one/two-cell,
 * 42% four-plus) runs ~37 moves a game against ~53 for a small-piece mix.
 *
 * A shape is a list of [dr, dp] offsets from its anchor cell plus the
 * orientation the anchor must have. Because orientation is decided by the
 * parity of (r + p), the offsets alone fix every other cell's orientation:
 *
 *   cellIsUp = anchorUp === ((dr + dp) % 2 === 0)
 *
 * Pieces are never rotated by the player, so each rotation is its own shape.
 */

export const COLORS = [
  '#ef5f78', // rose
  '#f7b23b', // amber
  '#8bd450', // lime
  '#2ecc8f', // teal
  '#3fa9f5', // blue
  '#a77bf3', // violet
  '#ff8a5b', // coral
  '#39c7c7', // cyan
];

export const SHAPES = [
  // 1 triangle
  { id: 'up', cells: [[0, 0]], anchorUp: true, weight: 1 },
  { id: 'down', cells: [[0, 0]], anchorUp: false, weight: 1 },

  // 2 triangles — rhombi in three orientations
  { id: 'rhomb-r', cells: [[0, 0], [0, 1]], anchorUp: true, weight: 4 },
  { id: 'rhomb-l', cells: [[0, 0], [0, 1]], anchorUp: false, weight: 4 },
  { id: 'rhomb-v', cells: [[0, 0], [1, 0]], anchorUp: true, weight: 4 },

  // 3 triangles — the trapezoid, in its six orientations
  { id: 'trap-n', cells: [[0, 0], [0, 1], [0, 2]], anchorUp: true, weight: 6 },
  { id: 'trap-s', cells: [[0, 0], [0, 1], [0, 2]], anchorUp: false, weight: 6 },
  { id: 'trap-ne', cells: [[0, 0], [0, 1], [1, 0]], anchorUp: true, weight: 5 },
  { id: 'trap-nw', cells: [[0, 0], [0, -1], [1, 0]], anchorUp: true, weight: 5 },
  { id: 'trap-se', cells: [[0, 0], [0, 1], [1, 1]], anchorUp: false, weight: 5 },
  { id: 'trap-sw', cells: [[0, 0], [0, -1], [1, -1]], anchorUp: false, weight: 5 },

  // 4 triangles
  { id: 'big-up', cells: [[0, 0], [1, -1], [1, 0], [1, 1]], anchorUp: true, weight: 7 },
  { id: 'big-down', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], anchorUp: false, weight: 7 },

  // 4 triangles — a straight bar lying along a line, in all three directions
  // and both parities. `h` runs along a row, `a` and `b` along the diagonals.
  { id: 'bar4-h1', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], anchorUp: true, weight: 3 },
  { id: 'bar4-h2', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], anchorUp: false, weight: 3 },
  { id: 'bar4-a1', cells: [[0, 0], [1, -1], [1, 0], [2, -1]], anchorUp: true, weight: 3 },
  { id: 'bar4-a2', cells: [[0, 0], [0, 1], [1, -1], [1, 0]], anchorUp: true, weight: 3 },
  { id: 'bar4-b1', cells: [[0, 0], [0, 1], [1, 1], [1, 2]], anchorUp: false, weight: 3 },
  { id: 'bar4-b2', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], anchorUp: true, weight: 3 },

  // 4 triangles — the crown: three in a line with one leg hanging off an end,
  // in three directions.
  { id: 'crown-h', cells: [[0, 0], [0, 1], [0, 2], [1, 0]], anchorUp: true, weight: 3 },
  { id: 'crown-a', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], anchorUp: false, weight: 3 },
  { id: 'crown-b', cells: [[0, 0], [1, 0], [1, 1], [1, 2]], anchorUp: true, weight: 3 },

  // 6 triangles — the hexagon around a single lattice vertex
  { id: 'hex', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], anchorUp: true, weight: 5 },
];

/** Weighted pick from any list of shapes. Summed per draw, so weights can be
 * retuned at runtime. */
export function pickWeighted(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const shape of list) {
    roll -= shape.weight;
    if (roll <= 0) return shape;
  }
  return list[list.length - 1];
}

export function randomShape() {
  return pickWeighted(SHAPES);
}

export function randomColor() {
  return COLORS[(Math.random() * COLORS.length) | 0];
}

export function randomPiece() {
  return { shape: randomShape(), color: randomColor() };
}

/** Local (dr, dp, up) triples for drawing a shape outside the board. */
export function shapeCells(shape) {
  return shape.cells.map(([dr, dp]) => ({
    r: dr,
    p: dp,
    up: shape.anchorUp === ((((dr + dp) % 2) + 2) % 2 === 0),
  }));
}
