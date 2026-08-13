/**
 * Triangular grid geometry.
 *
 * The board is a hexagon tiled with equilateral triangles. Horizontal lattice
 * lines are indexed 0..rows; `lines[i]` is how many unit segments long line i
 * is. A hexagon of radius k gives lines [k, k+1, ... 2k ... k+1, k].
 *
 * A cell is addressed by (r, p):
 *   r = row index (the strip between lattice line r and r+1)
 *   p = twice the x coordinate of the cell's left corner (integer, so that
 *       both up- and down-pointing triangles get integer addresses)
 *
 * Orientation is implied by parity: a cell points up iff (r + p) is odd.
 * That invariant holds because consecutive lattice lines differ in length by
 * one, so their vertex offsets alternate.
 */

export const H = Math.sqrt(3) / 2; // height of a unit-base triangle

export function hexLines(k) {
  const lines = [];
  for (let i = 0; i <= 2 * k; i++) lines.push(k + Math.min(i, 2 * k - i));
  return lines;
}

export function isUp(r, p) {
  return (((r + p) % 2) + 2) % 2 === 1;
}

export function cellKey(r, p) {
  return r + ',' + p;
}

/** Corner points of a triangle, in unit space (1 = triangle base width). */
export function polyPoints(r, p, up, shrink = 1) {
  const x = p / 2;
  const y = r * H;
  const pts = up
    ? [[x + 0.5, y], [x, y + H], [x + 1, y + H]]
    : [[x, y], [x + 1, y], [x + 0.5, y + H]];
  if (shrink === 1) return pts;
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  return pts.map(([px, py]) => [
    cx + (px - cx) * shrink,
    cy + (py - cy) * shrink,
  ]);
}

export function centroid(r, p, up) {
  const pts = polyPoints(r, p, up);
  return {
    x: (pts[0][0] + pts[1][0] + pts[2][0]) / 3,
    y: (pts[0][1] + pts[1][1] + pts[2][1]) / 3,
  };
}

export function pointsAttr(pts) {
  return pts.map(([x, y]) => x.toFixed(4) + ',' + y.toFixed(4)).join(' ');
}

/**
 * Build the hexagonal board.
 *
 * Every cell belongs to exactly three "lines" — one per lattice direction —
 * and a line clears when all of its cells are filled:
 *   r<n>  horizontal row
 *   a<n>  diagonal running up-right   (invariant: p + r, minus 1 for downs)
 *   b<n>  diagonal running up-left    (invariant: p - r, plus 1 for downs)
 */
export function buildBoard(k) {
  const lines = hexLines(k);
  const rows = lines.length - 1;
  const cells = new Map();
  const groups = new Map();

  const add = (r, p) => {
    const up = isUp(r, p);
    const key = cellKey(r, p);
    const c = centroid(r, p, up);
    const groupKeys = [
      'r' + r,
      'a' + (p + r - (up ? 0 : 1)),
      'b' + (p - r + (up ? 0 : 1)),
    ];
    cells.set(key, { key, r, p, up, cx: c.x, cy: c.y, groups: groupKeys });
    for (const g of groupKeys) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(key);
    }
  };

  for (let r = 0; r < rows; r++) {
    const top = lines[r];
    const bottom = lines[r + 1];
    // Down-pointing triangles rest their base on the top lattice line.
    for (let i = 0; i < top; i++) add(r, -top + 2 * i);
    // Up-pointing triangles rest their base on the bottom lattice line.
    for (let j = 0; j < bottom; j++) add(r, -bottom + 2 * j);
  }

  return {
    k,
    lines,
    rows,
    cells,
    groups,
    minX: -k,
    minY: 0,
    width: 2 * k,
    height: rows * H,
  };
}

/**
 * Which cell contains a point given in unit space? Returns a key or null.
 *
 * Within a row, the two diagonal edge families sit at integer values of
 * (x - t/2) and (x + t/2) once shifted by the row's left offset, where t is
 * the fractional height within the row. A point is inside a down-pointing
 * triangle when those two floors agree, and an up-pointing one when the
 * second is one greater.
 */
export function cellAtPoint(board, x, y) {
  const r = Math.floor(y / H);
  if (r < 0 || r >= board.rows) return null;
  const t = y / H - r;
  const xTop = -board.lines[r] / 2;
  const xBottom = -board.lines[r + 1] / 2;
  const i = Math.floor(x - t / 2 - xTop);
  const j = Math.floor(x + t / 2 - xTop);

  let p;
  if (i === j) {
    p = 2 * (xTop + i); // down-pointing
  } else if (j === i + 1) {
    // up-pointing: the apex sits on the top line at xTop + j
    const widening = board.lines[r + 1] > board.lines[r];
    p = 2 * (xBottom + (widening ? j : j - 1));
  } else {
    return null;
  }
  const key = cellKey(r, p);
  return board.cells.has(key) ? key : null;
}
