/**
 * Rendering helpers: the board SVG, tray pieces, the drag ghost and the HUD.
 */

import { polyPoints, pointsAttr, centroid } from './geometry.js';
import { shapeCells } from './shapes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * How far each triangle is pulled toward its centroid, leaving grout lines.
 * The rounded stroke paints back ~half its width, so the visible gap is
 * roughly (1 - CELL_SHRINK) * 2 * inradius - strokeWidth.
 */
const CELL_SHRINK = 0.84;

export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, value);
  }
  return node;
}

/** Draw every board cell once; returns a map of cell key -> <polygon>. */
export function renderBoard(svg, board) {
  const pad = 0.2;
  svg.setAttribute(
    'viewBox',
    `${board.minX - pad} ${board.minY - pad} ${board.width + pad * 2} ${board.height + pad * 2}`
  );
  svg.replaceChildren();

  const nodes = new Map();
  for (const cell of board.cells.values()) {
    const poly = svgEl('polygon', {
      class: 'cell',
      'data-key': cell.key,
      points: pointsAttr(polyPoints(cell.r, cell.p, cell.up, CELL_SHRINK)),
    });
    svg.appendChild(poly);
    nodes.set(cell.key, poly);
  }
  return nodes;
}

/** Geometry for a shape drawn on its own, anchored at (0, 0). */
export function shapeGeometry(shape) {
  const polys = shapeCells(shape).map((cell) => ({
    ...cell,
    points: polyPoints(cell.r, cell.p, cell.up, CELL_SHRINK),
  }));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys) {
    for (const [x, y] of poly.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    polys,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
    anchor: centroid(0, 0, shape.anchorUp),
  };
}

/** An <svg> of a single piece, sized in unit space via its viewBox. */
export function pieceSvg(shape, color, className = 'piece') {
  const geo = shapeGeometry(shape);
  const pad = 0.08;
  const svg = svgEl('svg', {
    class: className,
    viewBox: `${geo.minX - pad} ${geo.minY - pad} ${geo.width + pad * 2} ${geo.height + pad * 2}`,
    preserveAspectRatio: 'xMidYMid meet',
  });
  for (const poly of geo.polys) {
    svg.appendChild(
      svgEl('polygon', {
        points: pointsAttr(poly.points),
        fill: color,
        stroke: color,
      })
    );
  }
  return { svg, geo, pad };
}

/**
 * Colours are applied as inline styles, not presentation attributes: the
 * stylesheet's `.cell { fill: ... }` would otherwise win over an attribute.
 */
export function tintCell(node, color) {
  node.style.fill = color;
  node.style.stroke = color;
}

export function untintCell(node) {
  node.style.fill = '';
  node.style.stroke = '';
}

/** Paint a cell from game state, dropping any transient drag/clear styling. */
export function paintCell(node, color) {
  node.classList.remove('preview', 'blocked', 'clearing');
  if (color) {
    node.classList.add('filled');
    tintCell(node, color);
  } else {
    node.classList.remove('filled');
    untintCell(node);
  }
}

export function previewCell(node, color, valid) {
  node.classList.add(valid ? 'preview' : 'blocked');
  if (valid) tintCell(node, color);
}

/** Convert a client-space point into board unit space. */
export function toBoardPoint(svg, clientX, clientY) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

/**
 * Pixels per unit space for the board SVG. Taken from the live CTM so it stays
 * correct whichever axis the viewBox is letterboxed on.
 */
export function boardScale(svg) {
  const ctm = svg.getScreenCTM();
  return ctm ? ctm.a : 1;
}

export function floatText(layer, text, clientX, clientY, className = '') {
  const node = document.createElement('div');
  node.className = 'float-text ' + className;
  node.textContent = text;
  // Keep the label on screen when a piece is dropped near an edge.
  const margin = 70;
  node.style.left = clamp(clientX, margin, window.innerWidth - margin) + 'px';
  node.style.top = clamp(clientY, margin, window.innerHeight - margin) + 'px';
  layer.appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}
