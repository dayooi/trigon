/**
 * Game rules and state. Pure logic — no DOM in here.
 */

import { buildBoard, isUp, cellKey } from './geometry.js';
import { randomPiece } from './shapes.js';

const STORE_BEST = 'trigon.best';
const STORE_GEMS = 'trigon.gems';

const TRAY_SIZE = 3;
const MAX_COMBO_MULT = 4;

/*
 * How many candidate trays a refill may draw looking for one with at least a
 * single playable piece. Higher is more forgiving: it hands out second chances
 * when the board is nearly jammed. 1 disables the mercy entirely.
 */
export const REFILL_ATTEMPTS = 8;

// Gems reward multi-line drops only: a lone line pays nothing, two lines pay
// one gem, and every further line in the same drop pays two more.
//   lines  1  2  3  4  5
//   gems   0  1  3  5  7
const GEMS_MIN_LINES = 2;
const GEMS_AT_MIN = 1;
const GEMS_PER_EXTRA_LINE = 2;
const gemsForLines = (lines) =>
  lines >= GEMS_MIN_LINES
    ? GEMS_AT_MIN + (lines - GEMS_MIN_LINES) * GEMS_PER_EXTRA_LINE
    : 0;

function readNumber(key) {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export class Game {
  constructor(radius = 4) {
    this.board = buildBoard(radius);
    this.best = readNumber(STORE_BEST);
    this.gems = readNumber(STORE_GEMS);
    this.reset();
  }

  reset() {
    this.filled = new Map(); // cell key -> color
    this.score = 0;
    this.streak = 0;
    this.placements = 0;
    this.tray = new Array(TRAY_SIZE).fill(null);
    this.paused = false;
    this.over = false;
    this.refill();
  }

  /** Can `shape` be dropped with its anchor on cell (r, p)? */
  canPlace(shape, r, p) {
    if (isUp(r, p) !== shape.anchorUp) return false;
    for (const [dr, dp] of shape.cells) {
      const key = cellKey(r + dr, p + dp);
      if (!this.board.cells.has(key)) return false;
      if (this.filled.has(key)) return false;
    }
    return true;
  }

  /** First cell the shape fits on, or null if it fits nowhere. */
  findPlacement(shape) {
    for (const cell of this.board.cells.values()) {
      if (this.canPlace(shape, cell.r, cell.p)) return cell;
    }
    return null;
  }

  hasMoves() {
    return this.tray.some((piece) => piece && this.findPlacement(piece.shape));
  }

  /**
   * Drop tray piece `slot` with its anchor on (r, p).
   * Returns a summary of what happened, or null if the move was illegal.
   */
  place(slot, r, p) {
    const piece = this.tray[slot];
    if (this.over || this.paused || !piece) return null;
    if (!this.canPlace(piece.shape, r, p)) return null;

    const placed = piece.shape.cells.map(([dr, dp]) => cellKey(r + dr, p + dp));
    for (const key of placed) this.filled.set(key, piece.color);
    this.tray[slot] = null;
    this.placements++;

    const clearedLines = [];
    for (const [name, members] of this.board.groups) {
      if (members.every((key) => this.filled.has(key))) clearedLines.push(name);
    }

    const cleared = new Map(); // key -> color, captured before removal
    for (const name of clearedLines) {
      for (const key of this.board.groups.get(name)) {
        cleared.set(key, this.filled.get(key));
      }
    }

    let points = placed.length;
    let gems = 0;
    let multiplier = 1;

    if (clearedLines.length) {
      this.streak++;
      multiplier = Math.min(1 + (this.streak - 1) * 0.5, MAX_COMBO_MULT);
      const base = cleared.size * 10 + (clearedLines.length - 1) * 60;
      points += Math.round(base * multiplier);
      gems = gemsForLines(clearedLines.length);
      this.gems += gems;
      localStorage.setItem(STORE_GEMS, String(this.gems));
      for (const key of cleared.keys()) this.filled.delete(key);
    } else {
      this.streak = 0;
    }

    this.score += points;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(STORE_BEST, String(this.best));
    }

    if (this.tray.every((slotPiece) => !slotPiece)) this.refill();
    this.over = !this.hasMoves();

    return {
      placed,
      cleared: [...cleared].map(([key, color]) => ({ key, color })),
      lines: clearedLines.length,
      points,
      gems,
      streak: this.streak,
      multiplier,
    };
  }

  /**
   * Refill every empty tray slot. Retries a few times so a fresh tray is very
   * unlikely to be dead on arrival while the board still has room.
   */
  refill() {
    const empty = [];
    for (let i = 0; i < this.tray.length; i++) {
      if (!this.tray[i]) empty.push(i);
    }
    if (!empty.length) return;

    const keeps = this.tray.filter(Boolean);
    const attempts = this.refillAttempts ?? REFILL_ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidates = empty.map(() => randomPiece());
      const playable = [...keeps, ...candidates].some((piece) =>
        this.findPlacement(piece.shape)
      );
      if (playable || attempt === attempts - 1) {
        empty.forEach((slot, i) => {
          this.tray[slot] = candidates[i];
        });
        return;
      }
    }
  }
}
