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

const confirmEl = document.getElementById('confirm');
const confirmPiece = document.getElementById('confirm-piece');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

const drawEl = document.getElementById('draw');
const drawPanel = drawEl.querySelector('.draw-panel');
const reelEl = document.getElementById('reel');

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
    }

    trayEl.appendChild(slot);
    slots.push(slot);
  });
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

  // A piece with nowhere to go cannot be dragged anywhere useful; offer to
  // buy a smaller one instead.
  if (!game.findPlacement(piece.shape)) {
    askReshuffle(slotIndex);
    return;
  }

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
  else later(maybeOfferReshuffle, CLEAR_ANIM_MS + 260);
}

/* -------------------------------------------------------------- lucky draw */

let pendingSlot = null;
let pendingSpin = null;

/** Anywhere on the draw overlay releases the reel, so it is a big easy target. */
function releaseReel() {
  if (!pendingSpin) return;
  const spin = pendingSpin;
  pendingSpin = null;
  spin();
}

document.getElementById('draw-spin').addEventListener('click', releaseReel);
drawEl.addEventListener('click', releaseReel);

/**
 * Volunteer the offer when a piece goes dead, rather than waiting for a tap
 * nobody would think to make on a piece that visibly cannot be played.
 *
 * It speaks up even when the gems are short. Saying "not enough gems" is worth
 * an interruption: staying quiet leaves a dead piece sitting there with no
 * explanation, which reads as the game being broken rather than the player
 * being broke. Each piece is offered once, so it states its case and then
 * leaves you alone.
 */
function maybeOfferReshuffle() {
  if (game.over || game.paused || drawing || drag) return;
  if (confirmEl.classList.contains('shown')) return;

  for (let slot = 0; slot < game.tray.length; slot++) {
    const piece = game.tray[slot];
    if (!piece || piece.offered) continue;
    if (game.findPlacement(piece.shape)) continue;
    piece.offered = true;
    askReshuffle(slot);
    return;
  }
}

/** Offer to trade a stuck piece for a smaller one. */
function askReshuffle(slot) {
  const piece = game.tray[slot];
  if (!piece || game.over || game.paused || drawing) return;

  pendingSlot = slot;
  confirmPiece.replaceChildren(pieceSvg(piece.shape, piece.color).svg);

  const affordable = game.gems >= REROLL_COST;

  // The title says it is stuck and the button carries the price; the line
  // between them only needs to cover what the buttons cannot.
  confirmText.textContent = affordable
    ? 'Swap it for another piece?'
    : `Not enough gems — you have ${game.gems}.`;

  confirmYes.hidden = false;
  confirmYes.disabled = !affordable;
  confirmYes.innerHTML = `Reshuffle <span class="confirm-cost">${GEM_SVG}${REROLL_COST}</span>`;
  confirmNo.textContent = affordable ? 'Cancel' : 'Close';
  confirmEl.classList.add('shown');
}

function closeConfirm() {
  confirmEl.classList.remove('shown');
  pendingSlot = null;
}

confirmNo.addEventListener('click', closeConfirm);
confirmYes.addEventListener('click', () => {
  const slot = pendingSlot;
  closeConfirm();
  if (slot !== null) startDraw(slot);
});

function startDraw(slot) {
  if (drawing || drag) return;
  const result = game.reroll(slot);
  if (!result) return;

  drawing = true;
  syncHud(); // gems are spent up front
  // The tray is deliberately not repainted yet: the swap has already happened
  // in state, and redrawing here would show the answer behind the overlay
  // before the reel does. `drawing` keeps the stale piece from being grabbed.
  armReel(result);
}

/**
 * Build the reel and leave it parked, waiting for the player to set it going.
 * The winner is already decided — the spin is theatre — but it is the player's
 * theatre, so nothing moves until they touch it.
 */
function armReel(result) {
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

  drawPanel.classList.remove('landed');
  drawPanel.classList.add('ready');
  drawEl.classList.add('shown');

  const windowWidth = reelEl.parentElement.clientWidth;
  const offsetFor = (i) => -(i * REEL_ITEM_W + REEL_ITEM_W / 2 - windowWidth / 2);

  reelEl.style.transition = 'none';
  reelEl.style.transform = `translateX(${offsetFor(0)}px)`;

  pendingSpin = () => spinReel(offsetFor(landIndex));
}

/** Let it go, then hand the piece over once it settles. */
function spinReel(landOffset) {
  drawPanel.classList.remove('ready');
  void reelEl.offsetWidth; // flush the parked position so this one animates
  reelEl.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.16, 1)`;
  reelEl.style.transform = `translateX(${landOffset}px)`;

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
      else later(maybeOfferReshuffle, 260); // the new piece can be stuck too
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
  closeConfirm();
  drawEl.classList.remove('shown');
  drawPanel.classList.remove('ready', 'landed');
  pendingSpin = null;
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
