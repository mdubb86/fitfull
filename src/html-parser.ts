/** A function that parses an HTML string into a DOM Document. */
export type ParseHtml = (html: string) => Document;

/**
 * Node HTML parser, backed by linkedom. Used by the Node entry (src/index.ts).
 * The browser entry supplies a DOMParser-based implementation instead.
 */
import { parseHTML } from 'linkedom';

export const nodeParseHtml: ParseHtml = (html: string): Document => {
    return parseHTML(html).document as unknown as Document;
};
