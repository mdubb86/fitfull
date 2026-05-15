import type { Font } from 'fontkit';
import type { Token, FontWeight } from '../types.js';

/**
 * Environment-agnostic contract the fitter/measure pipeline depends on.
 * Implemented by NodeFontManager (system fonts + fs) and BrowserFontManager
 * (registered ArrayBuffers).
 */
export interface FontProvider {
    getFont(family: string, weight: FontWeight): Font;
    getUnitsPerEm(family: string, weight: FontWeight): number;
    /**
     * Ensure every font referenced by `tokens` is loaded.
     * `options.fonts` is read by each implementation as its own concrete type
     * (string[] paths for Node, BrowserFont[] for browser).
     */
    loadForTokens(
        tokens: Token[],
        options: { fonts?: unknown; _hint?: 'cli' | 'api' },
    ): Promise<void>;
    /** Drop all loaded fonts (backs Fitfull.clearFonts()). */
    clear(): void;
}

/**
 * Shared store: a family+weight -> Font map with getFont/getUnitsPerEm.
 * Both font managers compose this for the common lookup logic.
 */
export class FontStore {
    private fonts = new Map<string, Font>();

    private key(family: string, weight: FontWeight): string {
        return `${family}:${weight}`;
    }

    set(family: string, weight: FontWeight, font: Font): void {
        this.fonts.set(this.key(family, weight), font);
    }

    has(family: string, weight: FontWeight): boolean {
        return this.fonts.has(this.key(family, weight));
    }

    getFont(family: string, weight: FontWeight): Font {
        const font = this.fonts.get(this.key(family, weight));
        if (!font) {
            throw new Error(
                `Font "${family}" (weight "${weight}") not registered. ` +
                `Call registerFont() or pass it in fonts[].`,
            );
        }
        return font;
    }

    getUnitsPerEm(family: string, weight: FontWeight): number {
        return this.getFont(family, weight).unitsPerEm;
    }

    clear(): void {
        this.fonts.clear();
    }
}
