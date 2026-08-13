/**
 * Piece definitions (polyiamonds).
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
  { id: 'up', cells: [[0, 0]], anchorUp: true, weight: 4 },
  { id: 'down', cells: [[0, 0]], anchorUp: false, weight: 4 },

  // 2 triangles — rhombi in three orientations
  { id: 'rhomb-r', cells: [[0, 0], [0, 1]], anchorUp: true, weight: 7 },
  { id: 'rhomb-l', cells: [[0, 0], [0, 1]], anchorUp: false, weight: 7 },
  { id: 'rhomb-v', cells: [[0, 0], [1, 0]], anchorUp: true, weight: 7 },

  // 3 triangles — the trapezoid, in its six orientations
  { id: 'trap-n', cells: [[0, 0], [0, 1], [0, 2]], anchorUp: true, weight: 6 },
  { id: 'trap-s', cells: [[0, 0], [0, 1], [0, 2]], anchorUp: false, weight: 6 },
  { id: 'trap-ne', cells: [[0, 0], [0, 1], [1, 0]], anchorUp: true, weight: 5 },
  { id: 'trap-nw', cells: [[0, 0], [0, -1], [1, 0]], anchorUp: true, weight: 5 },
  { id: 'trap-se', cells: [[0, 0], [0, 1], [1, 1]], anchorUp: false, weight: 5 },
  { id: 'trap-sw', cells: [[0, 0], [0, -1], [1, -1]], anchorUp: false, weight: 5 },

  // 4 triangles
  { id: 'big-up', cells: [[0, 0], [1, -1], [1, 0], [1, 1]], anchorUp: true, weight: 5 },
  { id: 'big-down', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], anchorUp: false, weight: 5 },
  { id: 'bar4-u', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], anchorUp: true, weight: 3 },
  { id: 'bar4-d', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], anchorUp: false, weight: 3 },
  { id: 'crown', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]], anchorUp: true, weight: 2 },

  // 6 triangles — the hexagon around a single lattice vertex
  { id: 'hex', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], anchorUp: true, weight: 3 },
];

const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);

export function randomShape() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const shape of SHAPES) {
    roll -= shape.weight;
    if (roll <= 0) return shape;
  }
  return SHAPES[0];
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
