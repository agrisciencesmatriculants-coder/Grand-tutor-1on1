// Telegraph Engine — shared script-format helpers (TELEGRAPH_SPEC.md).
// Used by the recorder (/studio) and the player (/tv/:broadcastId).

import type { TelegraphScriptData, TelegraphStroke, TelegraphTool } from './types';

export const TELEGRAPH_LOGICAL_WIDTH = 1280;
export const TELEGRAPH_LOGICAL_HEIGHT = 720;

/** Quantize a normalized coordinate to 3 decimals (keeps scripts tiny). */
export function q(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Format bytes as a compact human string (e.g. "412 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format milliseconds as mm:ss or h:mm:ss. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Build a Telegraph Script JSON document. */
export function buildScript(strokes: TelegraphStroke[], durationMs: number): TelegraphScriptData {
  return {
    version: 1,
    width: TELEGRAPH_LOGICAL_WIDTH,
    height: TELEGRAPH_LOGICAL_HEIGHT,
    durationMs,
    strokes,
  };
}

export function scriptToBlob(script: TelegraphScriptData): Blob {
  return new Blob([JSON.stringify(script)], { type: 'application/json' });
}

/** Parse + lightly validate a fetched Telegraph Script. Throws on bad shape. */
export function parseScript(json: unknown): TelegraphScriptData {
  if (!json || typeof json !== 'object') throw new Error('Invalid telegraph script');
  const s = json as Partial<TelegraphScriptData>;
  if (s.version !== 1 || !Array.isArray(s.strokes)) {
    throw new Error('Unsupported telegraph script version');
  }
  return {
    version: 1,
    width: typeof s.width === 'number' ? s.width : TELEGRAPH_LOGICAL_WIDTH,
    height: typeof s.height === 'number' ? s.height : TELEGRAPH_LOGICAL_HEIGHT,
    durationMs: typeof s.durationMs === 'number' ? s.durationMs : 0,
    strokes: s.strokes as TelegraphStroke[],
  };
}

/** Prepare a canvas 2D context for drawing (fills paper background). */
export function prepCanvas(canvas: HTMLCanvasElement, paper = '#fffdf7'): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx;
}

/** Draw a single stroke onto a context sized `width` x `height` (normalized coords). */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: TelegraphStroke,
  width: number,
  height: number,
  paper = '#fffdf7',
): void {
  if (stroke.tool === 'clear') {
    ctx.save();
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return;
  }
  if (!stroke.pts || stroke.pts.length === 0) return;
  ctx.save();
  if (stroke.tool === 'eraser') {
    ctx.strokeStyle = paper;
    ctx.lineWidth = stroke.size * 4;
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }
  ctx.beginPath();
  const first = stroke.pts[0];
  ctx.moveTo(first[0] * width, first[1] * height);
  if (stroke.pts.length === 1) {
    // Single dot: draw a zero-length line so round cap renders.
    ctx.lineTo(first[0] * width + 0.01, first[1] * height + 0.01);
  } else {
    for (let i = 1; i < stroke.pts.length; i += 1) {
      ctx.lineTo(stroke.pts[i][0] * width, stroke.pts[i][1] * height);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Batch-draw every stroke with t <= offsetMs (late-joiner catch-up / seek). */
export function drawUpTo(
  ctx: CanvasRenderingContext2D,
  strokes: TelegraphStroke[],
  offsetMs: number,
  width: number,
  height: number,
  paper = '#fffdf7',
): number {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  let drawn = 0;
  for (const stroke of strokes) {
    if (stroke.t > offsetMs) break;
    drawStroke(ctx, stroke, width, height, paper);
    drawn += 1;
  }
  return drawn;
}

export function toolLabel(tool: TelegraphTool): string {
  if (tool === 'pen') return 'Pen';
  if (tool === 'eraser') return 'Eraser';
  return 'Clear';
}
