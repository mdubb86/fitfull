import { FitfullCore, type FitOptionsBase, type FitResult, type FitfullInput } from './fitfull.js';
import { BrowserFontManager, type BrowserFont } from './fonts/browser-font-manager.js';
import type { ParseHtml } from './html-parser.js';
import type { FontWeight } from './types.js';

export type { FitResult, FitfullInput } from './fitfull.js';
export type { Token, FontWeight, Alignment, PositionedLine, PositionedLayout, Shadow } from './types.js';
export type { BrowserFont } from './fonts/browser-font-manager.js';

/** Browser fit options — fonts are supplied as bytes. */
export type FitOptions = FitOptionsBase & {
    /** Fonts to register for this fit, supplied as bytes. */
    fonts?: BrowserFont[];
};

/** Browser HTML parser, backed by the native DOMParser. */
const browserParseHtml: ParseHtml = (html: string): Document => {
    return new DOMParser().parseFromString(html, 'text/html');
};

/**
 * Browser Fitfull — long-lived: register fonts once, fit many times.
 */
export class Fitfull extends FitfullCore {
    private readonly browserFonts: BrowserFontManager;

    constructor() {
        const fm = new BrowserFontManager();
        super(fm, browserParseHtml);
        this.browserFonts = fm;
    }

    /** Parse and register a font from raw bytes. */
    registerFont(family: string, weight: FontWeight, bytes: ArrayBuffer | Uint8Array): void {
        this.browserFonts.registerFont(family, weight, bytes);
    }
}

/**
 * One-shot fit. Registers any inline `fonts`, fits, returns. Sugar over the
 * Fitfull class for callers that don't need a long-lived instance.
 */
export async function fitfull(options: FitOptions): Promise<FitResult> {
    const ff = new Fitfull();
    return ff.fit(options);
}
