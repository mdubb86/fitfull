import type { Token, FontWeight } from 'fitfull';

/**
 * Default font family + weight for runs that have no explicit textStyle marks.
 * The WYSIWYG editor will set these when adding fonts (Phase 5); for now,
 * unset text defaults to this so the document still produces valid tokens.
 */
const DEFAULT_FONT = 'Geist';
const DEFAULT_WEIGHT: FontWeight = 'regular';
const DEFAULT_SIZE = 1;

/** Marks on a ProseMirror text node. */
interface PmMark {
    type: string;
    attrs?: { [k: string]: any };
}

interface PmNode {
    type: string;
    text?: string;
    marks?: PmMark[];
    content?: PmNode[];
    attrs?: { [k: string]: any };
}

/**
 * Convert a ProseMirror document JSON to a flat array of fitfull tokens.
 * Walks the doc → paragraphs → text nodes, mapping marks to font/weight/size.
 * Paragraphs are joined with explicit `\n` text tokens (matching the html-to-tokens convention).
 */
export function pmJsonToTokens(doc: PmNode): Token[] {
    const tokens: Token[] = [];
    const paragraphs = doc.content ?? [];

    paragraphs.forEach((para, paraIdx) => {
        // Split each text node at word boundaries — fitfull only breaks lines
        // between tokens, so a single token containing "Ship type that" can't
        // wrap. Match fitfull's own textToTokens convention (word + space tokens).
        for (const node of (para.content ?? [])) {
            if (node.type !== 'text' || !node.text) continue;
            tokens.push(...textNodeToTokens(node));
        }
        // Insert paragraph separator (newline) except after the last paragraph.
        if (paraIdx < paragraphs.length - 1) {
            tokens.push({
                text: '\n',
                font: DEFAULT_FONT,
                weight: DEFAULT_WEIGHT,
                size: DEFAULT_SIZE,
            });
        }
    });
    return tokens;
}

/** Build a token template from the node's marks, then stamp it onto each word/space. */
function textNodeToTokens(node: PmNode): Token[] {
    const marks = node.marks ?? [];
    const hasBold = marks.some(m => m.type === 'bold');
    const hasItalic = marks.some(m => m.type === 'italic');
    const textStyle = marks.find(m => m.type === 'textStyle');
    const tsAttrs = textStyle?.attrs ?? {};

    const weight: FontWeight =
        hasBold && hasItalic ? 'bolditalic' :
        hasBold ? 'bold' :
        hasItalic ? 'italic' :
        'regular';
    const size: number =
        typeof tsAttrs.size === 'number' ? tsAttrs.size : DEFAULT_SIZE;
    const font = typeof tsAttrs.fontFamily === 'string' ? tsAttrs.fontFamily : DEFAULT_FONT;
    const color = typeof tsAttrs.color === 'string' && tsAttrs.color ? tsAttrs.color : undefined;

    const make = (text: string): Token => {
        const tok: Token = { text, font, weight, size };
        if (color) tok.color = color;
        return tok;
    };

    // Walk the text emitting alternating word runs and individual whitespace
    // characters. Each space/newline gets its own token so fitfull can wrap
    // at any boundary. Preserve leading/trailing whitespace — a node like
    // "that " (trailing space) needs that space to survive across a node
    // boundary (the next node starts with a bold mark).
    const out: Token[] = [];
    let buf = '';
    for (const ch of node.text!) {
        if (ch === ' ' || ch === '\n') {
            if (buf) { out.push(make(buf)); buf = ''; }
            out.push(make(ch));
        } else {
            buf += ch;
        }
    }
    if (buf) out.push(make(buf));
    return out;
}

/**
 * Inverse of pmJsonToTokens. Rebuilds a ProseMirror document from a tokens array.
 * Splits on `\n` tokens to produce separate paragraphs. Per-token color (fitfull v1.5.0+)
 * round-trips through the `textStyle` mark's `color` attribute.
 */
export function tokensToPmJson(tokens: Token[]): PmNode {
    const paragraphs: PmNode[] = [{ type: 'paragraph', content: [] }];

    for (const tok of tokens) {
        if (tok.text === '\n') {
            paragraphs.push({ type: 'paragraph', content: [] });
            continue;
        }
        const para = paragraphs[paragraphs.length - 1];
        para.content!.push(tokenToTextNode(tok));
    }

    return { type: 'doc', content: paragraphs };
}

function tokenToTextNode(tok: Token): PmNode {
    const marks: PmMark[] = [];
    if (tok.weight === 'bold' || tok.weight === 'bolditalic') marks.push({ type: 'bold' });
    if (tok.weight === 'italic' || tok.weight === 'bolditalic') marks.push({ type: 'italic' });

    const tsAttrs: { fontFamily?: string; size?: number; color?: string } = {};
    if (tok.font !== DEFAULT_FONT) tsAttrs.fontFamily = tok.font;
    if (typeof tok.size === 'number' && tok.size !== DEFAULT_SIZE) tsAttrs.size = tok.size;
    if (typeof tok.color === 'string' && tok.color) tsAttrs.color = tok.color;
    if (Object.keys(tsAttrs).length > 0) {
        marks.push({ type: 'textStyle', attrs: tsAttrs });
    }

    const node: PmNode = { type: 'text', text: tok.text };
    if (marks.length > 0) node.marks = marks;
    return node;
}
