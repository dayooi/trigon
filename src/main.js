/**
 * Wiring: tray rendering, drag & drop, HUD, overlays.
 */

import { Game, REROLL_COST } from './game.js';
import { SHAPES, COLORS } from './shapes.js';
import { cellAtPoint } from './geometry.js';
import {
  renderBoard,
  pieceSvg,
  shapeGeometry,
  paintCell,
  previewCell,
  toBoardPoint,
  boardScale,
  floatText,
  tintCell,
  untintCell,
} from './ui.js';

const TOUCH_LIFT = 78; // px the piece floats above a finger
const SNAP_RADIUS = 0.75; // unit-space forgiveness when snapping to a cell
const CLEAR_ANIM_MS = 420; // keep in step with --clear-ms
const TRAY_SCALE = 0.85; // tray pieces, relative to board cell size
const REEL_ITEM_W = 104;  // keep in step with .reel-item width
const SPIN_MS = 1900;

const GEM_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M5 3h14l4 6-11 12L1 9z" fill="#e63b4d"/>' +
  '<path d="M5 3h14l-7 6z" fill="#ff7a86"/>' +
  '<path d="M1 9h22l-11 12z" fill="#c22437"/></svg>';

const game = new Game(4);

const boardSvg = document.getElementById('board');
const trayEl = document.getElementById('tray');
const ghostLayer = document.getElementById('ghost-layer');
const floatLayer = document.getElementById('float-layer');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gemsEl = document.getElementById('gems');
const pauseBtn = document.getElementById('pause');

const drawEl = document.getElementById('draw');
const drawPanel = drawEl.querySelector('.draw-panel');
const reelEl = document.getElementById('reel');
const drawNote = document.getElementById('draw-note');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const resumeBtn = document.getElementById('resume');
const restartBtn = document.getElementById('restart');

const cellNodes = renderBoard(boardSvg, game.board);
const slots = [];
let drag = null;
let drawing = false;
let timers = [];

/** setTimeout that a restart can cancel, so stale animations never resurface. */
function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function cancelTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/* ---------------------------------------------------------------- rendering */

function syncBoard() {
  for (const [key, node] of cellNodes) {
    paintCell(node, game.filled.get(key) || null);
  }
}

function syncHud() {
  scoreEl.textContent = game.score;
  bestEl.textContent = game.best;
  gemsEl.textContent = game.gems;
}

function renderTray() {
  trayEl.replaceChildren();
  slots.length = 0;

  // Draw tray pieces close to board scale so what you pick up is what you drop.
  const scale = boardScale(boardSvg) * TRAY_SCALE;

  game.tray.forEach((piece, index) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = String(index);

    if (piece) {
      const { svg, geo, pad } = pieceSvg(piece.shape, piece.color);
      svg.style.width = (geo.width + pad * 2) * scale + 'px';
      svg.style.height = (geo.height + pad * 2) * scale + 'px';
      slot.appendChild(svg);
      if (!game.findPlacement(piece.shape)) slot.classList.add('dead');
      slot.addEventListener('pointerdown', (event) => startDrag(event, index, svg));

      if (game.rerollPool(index).length) slot.appendChild(rerollButton(index));
    }

    trayEl.appendChild(slot);
    slots.push(slot);
  });
}

/** Gem-priced button that swaps this slot's piece for a smaller one. */
function rerollButton(index) {
  const button = document.createElement('button');
  button.className = 'reroll';
  button.innerHTML = `${GEM_SVG}<span>${REROLL_COST}</span>`;
  button.disabled = !game.canReroll(index);
  button.title = `Swap for a smaller piece (${REROLL_COST} gems)`;
  // Keep the press from starting a drag of the piece underneath.
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', () => startDraw(index));
  return button;
}

function clearPreview() {
  for (const node of cellNodes.values()) {
    node.classList.remove('preview', 'blocked');
    // Cells mid-clear keep their colour until the animation ends.
    if (node.classList.contains('clearing')) continue;
    if (!node.classList.contains('filled')) untintCell(node);
  }
}

/* ------------------------------------------------------------------- drag */

function startDrag(event, slotIndex, slotSvg) {
  if (game.over || game.paused || drag || drawing) return;
  const piece = game.tray[slotIndex];
  if (!piece) return;

  event.preventDefault();
  const grab = toBoardPoint(slotSvg, event.clientX, event.clientY);
  if (!grab) return;

  const geo = shapeGeometry(piece.shape);
  const pad = 0.08;
  const scale = boardScale(boardSvg);
  const { svg } = pieceSvg(piece.shape, piece.color, 'piece ghost-piece');

  const vbMinX = geo.minX - pad;
  const vbMinY = geo.minY - pad;
  svg.style.width = (geo.width + pad * 2) * scale + 'px';
  svg.style.height = (geo.height + pad * 2) * scale + 'px';
  ghostLayer.appendChild(svg);

  drag = {
    slot: slotIndex,
    piece,
    geo,
    ghost: svg,
    scale,
    vbMinX,
    vbMinY,
    grabX: grab.x,
    grabY: grab.y,
    lift: event.pointerType === 'touch' ? TOUCH_LIFT : 0,
    target: null,
    pointerId: event.pointerId,
  };

  slots[slotIndex].classList.add('dragging');
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', cancelDrag);
  moveGhost(event.clientX, event.clientY);
}

function moveGhost(clientX, clientY) {
  const { geo, scale, vbMinX, vbMinY, grabX, grabY, lift } = drag;
  const left = clientX - (grabX - vbMinX) * scale;
  const top = clientY - (grabY - vbMinY) * scale - lift;
  drag.ghost.style.transform = `translate(${left}px, ${top}px)`;

  // Where the anchor cell's centre currently sits, in board unit space.
  const anchorClientX = left + (geo.anchor.x - vbMinX) * scale;
  const anchorClientY = top + (geo.anchor.y - vbMinY) * scale;
  const point = toBoardPoint(boardSvg, anchorClientX, anchorClientY);

  clearPreview();
  drag.target = point ? findTarget(point.x, point.y, drag.piece.shape) : null;

  if (drag.target) {
    const { r, p } = drag.target;
    for (const [dr, dp] of drag.piece.shape.cells) {
      const node = cellNodes.get(r + dr + ',' + (p + dp));
      if (node) previewCell(node, drag.piece.color, true);
    }
  }
}

/** Nearest cell where the shape actually fits, within the snap radius. */
function findTarget(x, y, shape) {
  const direct = cellAtPoint(game.board, x, y);
  if (direct) {
    const cell = game.board.cells.get(direct);
    if (game.canPlace(shape, cell.r, cell.p)) return cell;
  }

  let best = null;
  let bestDistance = SNAP_RADIUS * SNAP_RADIUS;
  for (const cell of game.board.cells.values()) {
    if (cell.up !== shape.anchorUp) continue;
    const dx = cell.cx - x;
    const dy = cell.cy - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance && game.canPlace(shape, cell.r, cell.p)) {
      bestDistance = distance;
      best = cell;
    }
  }
  return best;
}

function onDragMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  event.preventDefault();
  moveGhost(event.clientX, event.clientY);
}

function onDragEnd(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { slot, target } = drag;
  const dropX = event.clientX;
  const dropY = event.clientY - drag.lift;
  teardownDrag();

  if (!target) return;
  const result = game.place(slot, target.r, target.p);
  if (!result) return;

  applyResult(result, dropX, dropY);
}

function cancelDrag() {
  if (drag) teardownDrag();
}

function teardownDrag() {
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', cancelDrag);
  drag.ghost.remove();
  slots[drag.slot]?.classList.remove('dragging');
  drag = null;
  clearPreview();
}

/* ---------------------------------------------------------------- outcomes */

function applyResult(result, x, y) {
  syncBoard();

  if (result.cleared.length) {
    for (const { key, color } of result.cleared) {
      const node = cellNodes.get(key);
      if (!node) continue;
      node.classList.add('clearing');
      tintCell(node, color);
    }
    later(syncBoard, CLEAR_ANIM_MS);

    const label = result.lines > 1 ? `${result.lines} LINES` : '1 LINE';
    floatText(floatLayer, label, x, y - 44, 'combo');
  }

  floatText(floatLayer, '+' + result.points, x, y);
  syncHud();
  renderTray();

  if (game.over) later(showGameOver, CLEAR_ANIM_MS + 120);
}

/* -------------------------------------------------------------- lucky draw */

function startDraw(slot) {
  if (drawing || drag) return;
  const result = game.reroll(slot);
  if (!result) return;

  drawing = true;
  syncHud(); // gems are spent up front
  renderTray(); // repaint so the old piece cannot be grabbed mid-spin
  spinReel(result);
}

/**
 * Scroll a strip of candidate pieces past a fixed centre marker and stop on
 * the one the game already drew. The reel is presentation only — the winner
 * was decided before the first frame.
 */
function spinReel(result) {
  const { pool, piece } = result;
  const items = [];
  const loops = Math.max(3, Math.ceil(18 / pool.length));
  for (let i = 0; i < loops; i++) items.push(...pool);

  const landIndex = items.length;
  items.push(piece.shape);
  items.push(...pool.slice(0, 3)); // a little runway past the winner

  reelEl.replaceChildren();
  items.forEach((shape, i) => {
    const item = document.createElement('div');
    item.className = 'reel-item';
    const color = i === landIndex ? piece.color : COLORS[i % COLORS.length];
    item.appendChild(pieceSvg(shape, color).svg);
    reelEl.appendChild(item);
  });

  const sizes = [...new Set(pool.map((s) => s.cells.length))].sort();
  drawNote.textContent = `${sizes.join('/')}-cell pieces only`;
  drawPanel.classList.remove('landed');
  drawEl.classList.add('shown');

  const windowWidth = reelEl.parentElement.clientWidth;
  const offsetFor = (i) => -(i * REEL_ITEM_W + REEL_ITEM_W / 2 - windowWidth / 2);

  reelEl.style.transition = 'none';
  reelEl.style.transform = `translateX(${offsetFor(0)}px)`;
  void reelEl.offsetWidth; // flush the jump so the next change animates
  reelEl.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.16, 1)`;
  reelEl.style.transform = `translateX(${offsetFor(landIndex)}px)`;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    reelEl.removeEventListener('transitionend', onEnd);
    drawPanel.classList.add('landed');
    later(() => {
      drawEl.classList.remove('shown');
      drawing = false;
      renderTray();
      syncHud();
      if (game.over) later(showGameOver, 200);
    }, 850);
  };
  const onEnd = (event) => {
    if (event.propertyName === 'transform') finish();
  };
  reelEl.addEventListener('transitionend', onEnd);
  later(finish, SPIN_MS + 400); // in case the transition never reports back
}

/* ---------------------------------------------------------------- overlays */

function showOverlay(title, body, { resumable }) {
  overlayTitle.textContent = title;
  overlayBody.innerHTML = body;
  resumeBtn.hidden = !resumable;
  overlay.classList.add('shown');
}

function hideOverlay() {
  overlay.classList.remove('shown');
}

function showGameOver() {
  const best = game.score >= game.best ? '<p class="cheer">New best score!</p>' : '';
  showOverlay(
    'Game Over',
    `${best}<p><span>Score</span><strong>${game.score}</strong></p>
     <p><span>Best</span><strong>${game.best}</strong></p>
     <p><span>Gems</span><strong>${game.gems}</strong></p>`,
    { resumable: false }
  );
}

function togglePause(force) {
  if (game.over) return;
  const next = force ?? !game.paused;
  game.paused = next;
  if (next) {
    showOverlay(
      'Paused',
      `<p><span>Score</span><strong>${game.score}</strong></p>
       <p><span>Best</span><strong>${game.best}</strong></p>`,
      { resumable: true }
    );
  } else {
    hideOverlay();
  }
}

function restart() {
  cancelTimers();
  drawEl.classList.remove('shown');
  drawing = false;
  game.reset();
  hideOverlay();
  syncBoard();
  syncHud();
  renderTray();
}

pauseBtn.addEventListener('click', () => togglePause());
resumeBtn.addEventListener('click', () => togglePause(false));
restartBtn.addEventListener('click', restart);

document.addEventListener('keydown', (event) => {
  if (event.key === 'p') togglePause();
  if (event.key === 'r') restart();
});

window.addEventListener('resize', () => {
  if (drag) drag.scale = boardScale(boardSvg);
  else renderTray();
});

/* ------------------------------------------------------------------- start */

syncBoard();
syncHud();
renderTray();

// Handy for tinkering in the console while adding features.
window.trigon = { game, SHAPES, syncBoard, syncHud, renderTray, restart };
