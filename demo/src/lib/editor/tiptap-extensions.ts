import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { TextStyle, FontFamily, Color } from '@tiptap/extension-text-style';
import History from '@tiptap/extension-history';
import { Extension } from '@tiptap/core';

/**
 * Custom RelativeSize extension: adds a `size` numeric attribute to the
 * `textStyle` mark. Used by fitfull tokens as a per-run emphasis multiplier
 * (1.0 = base, 2.0 = double-size).
 *
 * Pattern from docs/superpowers/research/2026-05-16-tiptap-svelte.md section 3.
 * Mirrors upstream FontSize extension exactly — adds a global attribute on the
 * shared `textStyle` mark rather than defining a new mark. This keeps the
 * round-trip with fitfull tokens lossless (one textStyle mark per styled run).
 */
export const RelativeSize = Extension.create({
    name: 'relativeSize',
    addOptions() { return { types: ['textStyle'] }; },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                size: {
                    default: null,
                    parseHTML: (el: HTMLElement) => {
                        const v = el.style.fontSize?.replace(/em$/, '');
                        return v ? parseFloat(v) : null;
                    },
                    renderHTML: (attrs: any) => {
                        if (!attrs.size) return {};
                        return { style: `font-size: ${attrs.size}em` };
                    },
                },
            },
        }];
    },
});

/**
 * Editor extensions. NO StarterKit — we cherry-pick only what tokens can carry.
 * Mark set: bold, italic, textStyle (with fontFamily + color + size attributes).
 * No headings, lists, underline, link — anything that doesn't round-trip to tokens.
 */
export const editorExtensions = [
    Document,
    Paragraph,
    Text,
    History,
    Bold,
    Italic,
    TextStyle,
    FontFamily,
    Color,
    RelativeSize,
];
