import { FitfullCore, type FitOptionsBase } from './fitfull.js';
import { NodeFontManager } from './fonts/node-font-manager.js';
import { nodeParseHtml } from './html-parser.js';

// Types
export type { FitfullInput, FitResult } from './fitfull.js';
export type { Token, FontWeight, Alignment, PositionedLine, PositionedLayout } from './types.js';

/** Node fit options — fonts are file paths. */
export type FitOptions = FitOptionsBase & {
    /** Font file paths to pre-load. Prevents system font scanning if all needed fonts are covered. */
    fonts?: string[];
    /** @internal Used by the CLI to format the resolution hint message. */
    _hint?: 'cli' | 'api';
};

/** Node Fitfull — wires the system-font provider + linkedom HTML parser. */
export class Fitfull extends FitfullCore {
    private static instance: Fitfull | null = null;

    constructor() {
        super(new NodeFontManager(), nodeParseHtml);
    }

    /**
     * Get the singleton instance.
     * Font cache persists across all fit() calls.
     */
    static get(): Fitfull {
        return (Fitfull.instance ??= new Fitfull());
    }

    /**
     * Create a new instance with its own font cache.
     * Use when you need isolated font management or want to allow GC.
     */
    static create(): Fitfull {
        return new Fitfull();
    }
}

/** Namespace accessor — preserves the existing fitfull.get()/create() API. */
export const fitfull = {
    /**
     * Get the singleton instance.
     * Font cache persists across all fit() calls.
     */
    get: (): Fitfull => Fitfull.get(),

    /**
     * Create a new instance with its own font cache.
     */
    create: (): Fitfull => Fitfull.create(),
};
