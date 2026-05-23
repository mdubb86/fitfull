import { create } from 'fontkit';
import type { Font } from 'fontkit';
import type { Token, FontWeight } from '../types.js';
import { normalizeFamily } from './normalize.js';
import { FontStore, type FontProvider } from './font-provider.js';

/** A font supplied to the browser API as raw bytes. */
export interface BrowserFont {
    family: string;
    weight: FontWeight;
    bytes: ArrayBuffer | Uint8Array;
}

/**
 * Browser FontProvider. Fonts are supplied as bytes via registerFont() or
 * inline in fit() options. No system-font discovery, no fuzzy fallback.
 */
export class BrowserFontManager implements FontProvider {
    private store = new FontStore();

    /** Parse and register a font from raw bytes. Family is normalized to match token lookups. */
    registerFont(family: string, weight: FontWeight, bytes: ArrayBuffer | Uint8Array): void {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        // create() is typed for Node Buffer but accepts any Uint8Array at runtime.
        const parsed = create(u8 as Buffer);
        if ('fonts' in parsed) {
            throw new Error(
                `registerFont: "${family}" is a font collection (.ttc/.otc). ` +
                `Extract a single face before registering.`,
            );
        }
        this.store.set(normalizeFamily(family), weight, parsed as Font);
    }

    getFont(family: string, weight: FontWeight): Font {
        return this.store.getFont(normalizeFamily(family), weight);
    }

    getUnitsPerEm(family: string, weight: FontWeight): number {
        return this.store.getUnitsPerEm(normalizeFamily(family), weight);
    }

    async loadForTokens(
        tokens: Token[],
        options: { fonts?: unknown; _hint?: 'cli' | 'api' },
    ): Promise<void> {
        // Register any inline fonts not already registered.
        const inline = (options.fonts as BrowserFont[] | undefined) ?? [];
        for (const f of inline) {
            if (!this.store.has(normalizeFamily(f.family), f.weight)) {
                this.registerFont(f.family, f.weight, f.bytes);
            }
        }
        // Validate every token's font is available; throw early with a clear message.
        for (const token of tokens) {
            this.getFont(token.font, token.weight);
        }
    }

    clear(): void {
        this.store.clear();
    }
}
