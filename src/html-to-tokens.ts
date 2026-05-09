import { parseHTML } from 'linkedom';
import type { Token } from './types.js';
import { normalizeFamily } from './fonts/normalize.js';


/** Internal style state, inherited through the DOM tree */
type StyleContext = {
    size: number;
    font: string;
    bold: boolean;
    italic: boolean;
};

/** Intermediate representation: a run of text with uniform style */
type StyledRun = {
    text: string;
    size: number;
    font: string;
    bold: boolean;
    italic: boolean;
};

function contextToWeight(ctx: { bold: boolean; italic: boolean }): Token['weight'] {
    if (ctx.bold && ctx.italic) return 'bolditalic';
    if (ctx.bold) return 'bold';
    if (ctx.italic) return 'italic';
    return 'regular';
}

function parseFontSize(value: string, parentSize: number): number {
    value = value.trim();
    if (value.endsWith('px')) return parseFloat(value);
    if (value.endsWith('pt')) return parseFloat(value) * (4 / 3);
    if (value.endsWith('em')) return parseFloat(value) * parentSize;
    if (value.endsWith('%')) return (parseFloat(value) / 100) * parentSize;
    const num = parseFloat(value);
    return isNaN(num) ? parentSize : num;
}

function cssFontWeightToBold(value: string): boolean {
    value = value.trim().toLowerCase();
    if (value === 'bold' || value === 'bolder') return true;
    if (value === 'normal' || value === 'lighter') return false;
    const num = parseInt(value, 10);
    if (!isNaN(num)) return num >= 600;
    return false;
}

function cssFontStyleToItalic(value: string): boolean {
    value = value.trim().toLowerCase();
    return value === 'italic' || value === 'oblique';
}


function parseInlineStyle(style: string): {
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    fontStyle?: string;
} {
    const result: Record<string, string> = {};
    // Split on semicolons, then key: value
    for (const decl of style.split(';')) {
        const colon = decl.indexOf(':');
        if (colon === -1) continue;
        const prop = decl.slice(0, colon).trim().toLowerCase();
        const val = decl.slice(colon + 1).trim();
        if (prop === 'font-size') result.fontSize = val;
        else if (prop === 'font-weight') result.fontWeight = val;
        else if (prop === 'font-family') result.fontFamily = val;
        else if (prop === 'font-style') result.fontStyle = val;
    }
    return result;
}

const BOLD_TAGS = new Set(['b', 'strong']);
const ITALIC_TAGS = new Set(['i', 'em']);

function walkNode(node: any, parentCtx: StyleContext, runs: StyledRun[]): void {
    // Text node
    if (node.nodeType === 3) {
        const text = node.textContent;
        if (text) {
            runs.push({
                text,
                size: parentCtx.size,
                font: parentCtx.font,
                bold: parentCtx.bold,
                italic: parentCtx.italic,
            });
        }
        return;
    }

    // Only process element nodes
    if (node.nodeType !== 1) return;

    const tag = node.tagName?.toLowerCase() || '';

    // <br> → newline run
    if (tag === 'br') {
        runs.push({
            text: '\n',
            size: parentCtx.size,
            font: parentCtx.font,
            bold: parentCtx.bold,
            italic: parentCtx.italic,
        });
        return;
    }

    // Build child context
    const ctx: StyleContext = { ...parentCtx };

    // Tag-based overrides
    if (BOLD_TAGS.has(tag)) ctx.bold = true;
    if (ITALIC_TAGS.has(tag)) ctx.italic = true;

    // Inline style overrides
    const style = node.getAttribute?.('style');
    if (style) {
        const parsed = parseInlineStyle(style);
        if (parsed.fontSize) ctx.size = parseFontSize(parsed.fontSize, parentCtx.size);
        if (parsed.fontWeight) ctx.bold = cssFontWeightToBold(parsed.fontWeight);
        if (parsed.fontFamily) ctx.font = normalizeFamily(parsed.fontFamily);
        if (parsed.fontStyle) ctx.italic = cssFontStyleToItalic(parsed.fontStyle);
    }

    // Recurse into children
    for (const child of node.childNodes) {
        walkNode(child, ctx, runs);
    }
}

function runsToTokens(runs: StyledRun[]): Token[] {
    if (runs.length === 0) return [];

    // 1. Normalize whitespace within each run (except \n from <br>)
    //    Replace tabs, carriage returns, and newlines (that aren't \n from <br>) with spaces
    //    Then collapse consecutive spaces
    const normalized: StyledRun[] = [];
    for (const run of runs) {
        if (run.text === '\n') {
            // Explicit line break from <br>, keep as-is
            normalized.push(run);
            continue;
        }
        // Replace whitespace chars with space, collapse
        const text = run.text.replace(/[\t\r\n\f]/g, ' ');
        if (text) {
            normalized.push({ ...run, text });
        }
    }

    // 2. Collapse spaces across run boundaries and around \n tokens
    //    Build a flat array of characters with style info
    type StyledChar = { ch: string; size: number; font: string; bold: boolean; italic: boolean };
    const chars: StyledChar[] = [];
    for (const run of normalized) {
        for (const ch of run.text) {
            chars.push({ ch, size: run.size, font: run.font, bold: run.bold, italic: run.italic });
        }
    }

    // Collapse consecutive spaces
    const collapsed: StyledChar[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c.ch === ' ') {
            // Skip if previous char is already a space
            if (collapsed.length > 0 && collapsed[collapsed.length - 1].ch === ' ') continue;
            collapsed.push(c);
        } else {
            collapsed.push(c);
        }
    }

    // Strip spaces adjacent to \n
    const cleaned: StyledChar[] = [];
    for (let i = 0; i < collapsed.length; i++) {
        const c = collapsed[i];
        if (c.ch === ' ') {
            // Skip space if next char is \n or prev char is \n
            const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
            const next = i + 1 < collapsed.length ? collapsed[i + 1] : null;
            if (prev?.ch === '\n' || next?.ch === '\n') continue;
        }
        cleaned.push(c);
    }

    // Trim leading and trailing spaces
    while (cleaned.length > 0 && cleaned[0].ch === ' ') cleaned.shift();
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].ch === ' ') cleaned.pop();

    if (cleaned.length === 0) return [];

    // 3. Split into tokens: group consecutive non-space, non-newline chars with same style
    //    Spaces and newlines become their own tokens
    const tokens: Token[] = [];
    let i = 0;
    while (i < cleaned.length) {
        const c = cleaned[i];
        if (c.ch === ' ' || c.ch === '\n') {
            tokens.push({ text: c.ch, size: c.size, font: c.font, weight: contextToWeight(c) });
            i++;
        } else {
            // Accumulate word characters with same style
            let text = c.ch;
            let j = i + 1;
            while (j < cleaned.length && cleaned[j].ch !== ' ' && cleaned[j].ch !== '\n') {
                const next = cleaned[j];
                // Break on style change
                if (next.size !== c.size || next.font !== c.font || next.bold !== c.bold || next.italic !== c.italic) {
                    break;
                }
                text += next.ch;
                j++;
            }
            tokens.push({ text, size: c.size, font: c.font, weight: contextToWeight(c) });
            i = j;
        }
    }

    return tokens;
}

function applyStyleBlocks(document: any): void {
    const styleEls = [...document.querySelectorAll('style')];
    if (styleEls.length === 0) return;

    const cssText = styleEls.map((el: any) => el.textContent || '').join('\n');

    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = ruleRegex.exec(cssText)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2];
        if (!selector || !declarations.trim()) continue;

        let elements: any[];
        try {
            elements = [...document.querySelectorAll(selector)];
        } catch {
            continue; // skip unsupported selectors silently
        }

        for (const el of elements) {
            const existing = el.getAttribute('style') || '';
            const existingProps = new Set(
                existing.split(';')
                    .map((d: string) => d.split(':')[0].trim().toLowerCase())
                    .filter(Boolean)
            );
            const toApply = declarations.split(';')
                .map((d: string) => d.trim())
                .filter((d: string) => {
                    const prop = d.split(':')[0].trim().toLowerCase();
                    return prop && !existingProps.has(prop);
                })
                .join('; ');
            if (toApply) {
                el.setAttribute('style', existing ? `${existing}; ${toApply}` : toApply);
            }
        }
    }

    // Remove style elements so their text content is not walked as tokens
    for (const el of styleEls) {
        el.remove();
    }
}

/** Convert HTML string to Token array. All text must have explicit font-family and font-size styling. */
export function htmlToTokens(html: string): Token[] {
    if (!html.trim()) return [];

    // 1. Parse DOM
    const hasBody = /<body[\s>]/i.test(html);
    const wrapped = hasBody
        ? `<!DOCTYPE html><html>${html}</html>`
        : `<!DOCTYPE html><html><body>${html}</body></html>`;
    const { document } = parseHTML(wrapped);

    // 2. Inline CSS <style> block rules onto elements
    applyStyleBlocks(document);

    // 3. Extract body styles for root context
    const bodyStyle = document.body.getAttribute?.('style') || '';
    const parsed = parseInlineStyle(bodyStyle);

    if (!parsed.fontFamily) {
        throw new Error('HTML must have font-family styling. Add style to <body> or wrap content in a styled element.');
    }
    if (!parsed.fontSize) {
        throw new Error('HTML must have font-size styling. Add style to <body> or wrap content in a styled element.');
    }

    const rootCtx: StyleContext = {
        size: parseFontSize(parsed.fontSize, 16),
        font: normalizeFamily(parsed.fontFamily),
        bold: parsed.fontWeight ? cssFontWeightToBold(parsed.fontWeight) : false,
        italic: parsed.fontStyle ? cssFontStyleToItalic(parsed.fontStyle) : false,
    };

    // 4. Walk DOM, collect styled runs
    const runs: StyledRun[] = [];
    walkNode(document.body, rootCtx, runs);

    // 5. Collapse whitespace and tokenize
    return runsToTokens(runs);
}
