/**
 * Path adapter — converts fontkit's per-glyph paths into a composed Path
 * that mimics the opentype.js Path API used by measure.ts and render.ts.
 *
 * Two coordinate transforms happen:
 *   1. Per-glyph: scale by (fontSize / unitsPerEm), translate by glyph position from layout()
 *   2. Y-axis flip: fontkit paths are Y-up (font design coords); SVG is Y-down
 */

import type { Font, Path as FontkitPath } from 'fontkit';

export interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
}

/** Flip Y coordinates around the given baseline (Y-up → Y-down). */
export function flipY(commands: PathCommand[], baseline: number): PathCommand[] {
    return commands.map(cmd => {
        const out: PathCommand = { type: cmd.type };
        if (cmd.x !== undefined) out.x = cmd.x;
        if (cmd.y !== undefined) out.y = baseline - cmd.y;
        if (cmd.x1 !== undefined) out.x1 = cmd.x1;
        if (cmd.y1 !== undefined) out.y1 = baseline - cmd.y1;
        if (cmd.x2 !== undefined) out.x2 = cmd.x2;
        if (cmd.y2 !== undefined) out.y2 = baseline - cmd.y2;
        return out;
    });
}

/** Apply uniform scale, then translate. (No rotation/skew needed for text.) */
export function transformPath(
    commands: PathCommand[],
    scale: number,
    dx: number,
    dy: number,
): PathCommand[] {
    const tx = (v: number | undefined) => (v === undefined ? undefined : v * scale + dx);
    const ty = (v: number | undefined) => (v === undefined ? undefined : v * scale + dy);
    return commands.map(cmd => {
        const out: PathCommand = { type: cmd.type };
        if (cmd.x !== undefined) out.x = tx(cmd.x);
        if (cmd.y !== undefined) out.y = ty(cmd.y);
        if (cmd.x1 !== undefined) out.x1 = tx(cmd.x1);
        if (cmd.y1 !== undefined) out.y1 = ty(cmd.y1);
        if (cmd.x2 !== undefined) out.x2 = tx(cmd.x2);
        if (cmd.y2 !== undefined) out.y2 = ty(cmd.y2);
        return out;
    });
}

/** Round to n decimal places, stripping trailing zeros (SVG-compact). */
function fmt(n: number, precision: number): string {
    return parseFloat(n.toFixed(precision)).toString();
}

/** Emit SVG path d-string from commands array. Compact: no leading zeros, trimmed. */
export function toPathData(commands: PathCommand[], precision: number): string {
    return commands.map(cmd => {
        switch (cmd.type) {
            case 'M': return `M${fmt(cmd.x!, precision)} ${fmt(cmd.y!, precision)}`;
            case 'L': return `L${fmt(cmd.x!, precision)} ${fmt(cmd.y!, precision)}`;
            case 'C': return `C${fmt(cmd.x1!, precision)} ${fmt(cmd.y1!, precision)} ${fmt(cmd.x2!, precision)} ${fmt(cmd.y2!, precision)} ${fmt(cmd.x!, precision)} ${fmt(cmd.y!, precision)}`;
            case 'Q': return `Q${fmt(cmd.x1!, precision)} ${fmt(cmd.y1!, precision)} ${fmt(cmd.x!, precision)} ${fmt(cmd.y!, precision)}`;
            case 'Z': return 'Z';
        }
    }).join('');
}

/**
 * Conservative bounding box including all control points. This matches
 * opentype.js's Path.getBoundingBox() behavior. For tighter (true) bezier
 * bounds you'd compute curve extrema; we don't need that precision here.
 */
export function getBoundingBox(commands: PathCommand[]): { x1: number; y1: number; x2: number; y2: number } {
    if (commands.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const consider = (x?: number, y?: number) => {
        if (x !== undefined) { if (x < x1) x1 = x; if (x > x2) x2 = x; }
        if (y !== undefined) { if (y < y1) y1 = y; if (y > y2) y2 = y; }
    };
    for (const cmd of commands) {
        consider(cmd.x, cmd.y);
        consider(cmd.x1, cmd.y1);
        consider(cmd.x2, cmd.y2);
    }
    return { x1, y1, x2, y2 };
}

export interface ComposedPath {
    commands: PathCommand[];
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
    toPathData(precision: number): string;
}

/**
 * Compose a positioned text path from a fontkit Font + text.
 * Mirrors opentype.js's font.getPath(text, x, baseline, fontSize) API.
 *
 * GPOS kerning is automatically applied by font.layout().
 */
export function composeGlyphRunPath(
    font: Font,
    text: string,
    x: number,
    baseline: number,
    fontSize: number,
): ComposedPath {
    const scale = fontSize / font.unitsPerEm;
    const run = font.layout(text);

    const commands: PathCommand[] = [];
    let cursorX = x;

    for (let i = 0; i < run.glyphs.length; i++) {
        const glyph = run.glyphs[i];
        const pos = run.positions[i];

        // fontkit glyph.path is in font design units, Y-up
        const glyphCmds = fontkitPathToCommands(glyph.path as unknown as FontkitPath);

        // Apply Y-flip first (since baseline is in SVG/Y-down space, flip is around y=0)
        const flipped = flipY(glyphCmds, 0);

        // Then scale + translate to (cursorX + xOffset*scale, baseline - yOffset*scale)
        const dx = cursorX + (pos.xOffset ?? 0) * scale;
        const dy = baseline - (pos.yOffset ?? 0) * scale;
        const transformed = transformPath(flipped, scale, dx, dy);

        commands.push(...transformed);
        cursorX += pos.xAdvance * scale;
    }

    return {
        commands,
        getBoundingBox: () => getBoundingBox(commands),
        toPathData: (precision: number) => toPathData(commands, precision),
    };
}

/** Convert a fontkit Path object to our PathCommand[] format. */
function fontkitPathToCommands(path: FontkitPath): PathCommand[] {
    // fontkit Path stores commands as: { commands: Array<{ command: 'moveTo'|'lineTo'|'quadraticCurveTo'|'bezierCurveTo'|'closePath', args: number[] }> }
    const out: PathCommand[] = [];
    for (const cmd of (path as any).commands) {
        switch (cmd.command) {
            case 'moveTo':
                out.push({ type: 'M', x: cmd.args[0], y: cmd.args[1] });
                break;
            case 'lineTo':
                out.push({ type: 'L', x: cmd.args[0], y: cmd.args[1] });
                break;
            case 'quadraticCurveTo':
                out.push({ type: 'Q', x1: cmd.args[0], y1: cmd.args[1], x: cmd.args[2], y: cmd.args[3] });
                break;
            case 'bezierCurveTo':
                out.push({ type: 'C', x1: cmd.args[0], y1: cmd.args[1], x2: cmd.args[2], y2: cmd.args[3], x: cmd.args[4], y: cmd.args[5] });
                break;
            case 'closePath':
                out.push({ type: 'Z' });
                break;
        }
    }
    return out;
}
