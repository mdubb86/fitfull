import opentype, { Font } from 'opentype.js';
import getSystemFontsModule from 'get-system-fonts';

// Handle both ESM default export and CommonJS
const getSystemFonts = (getSystemFontsModule as any).default ?? getSystemFontsModule;
import type { FontMap } from '../types.js';
import type { FontWeight } from '../types.js';
import type { FontConfig } from './types.js';
import { buildKerningLookup } from './font-metrics.js';

// Helper to safely get string from font name table entry
function getNameString(entry: unknown): string {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object' && 'en' in entry) {
        return String((entry as { en: unknown }).en);
    }
    return '';
}

// Suppress opentype.js kern warnings during font loading
async function loadFontQuiet(path: string): Promise<Font> {
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('kern subtable')) return;
        originalWarn.apply(console, args);
    };
    try {
        return await opentype.load(path);
    } finally {
        console.warn = originalWarn;
    }
}

/** Cached system font indexes */
let primaryIndex: Map<string, Map<string, string>> | null = null;
let secondaryIndex: Map<string, Map<string, string>> | null = null;
let indexPromise: Promise<void> | null = null;

/**
 * Build indexes of system fonts by loading and parsing each one.
 * Primary index uses preferredFamily (Name ID 16) — matches CSS font-family names.
 * Secondary index uses fontFamily (Name ID 1) — the internal font name.
 * Safe to call concurrently — deduplicates via shared promise.
 */
async function buildSystemFontIndexes(): Promise<void> {
    if (primaryIndex) return;
    if (indexPromise) return indexPromise;

    indexPromise = (async () => {
        const primary = new Map<string, Map<string, string>>();
        const secondary = new Map<string, Map<string, string>>();
        const paths = await getSystemFonts();
        console.log(`[font-manager] getSystemFonts returned ${paths.length} paths`);

        for (const path of paths) {
            // Skip font collections (.ttc) - opentype.js doesn't support them
            if (path.toLowerCase().endsWith('.ttc')) continue;

            try {
                const font = await loadFontQuiet(path);
                const preferredFamily = getNameString((font.names as any).preferredFamily).toLowerCase();
                const family = getNameString(font.names.fontFamily).toLowerCase();
                const subfamily = (getNameString(font.names.fontSubfamily) || 'regular').toLowerCase();

                if (preferredFamily) {
                    if (!primary.has(preferredFamily)) {
                        primary.set(preferredFamily, new Map());
                    }
                    primary.get(preferredFamily)!.set(subfamily, path);
                }

                if (family) {
                    if (!secondary.has(family)) {
                        secondary.set(family, new Map());
                    }
                    secondary.get(family)!.set(subfamily, path);
                }
            } catch (e: any) {
                // Log first failure to help debug
                if (primary.size === 0 && secondary.size === 0) {
                    console.error(`[font-manager] first font load failure: ${path}`, e?.message);
                }
            }
        }

        console.log(`[font-manager] indexed ${primary.size} preferred families, ${secondary.size} font families`);
        primaryIndex = primary;
        secondaryIndex = secondary;
    })();

    return indexPromise;
}

/**
 * Check if a string looks like a file path
 */
function isFilePath(str: string): boolean {
    return str.includes('/') || str.includes('\\') ||
           str.endsWith('.ttf') || str.endsWith('.otf') ||
           str.endsWith('.woff') || str.endsWith('.woff2');
}

/**
 * Resolve a font reference (path or name) to an actual file path
 */
async function resolveFontPath(ref: string, weight: string): Promise<string> {
    // If it's already a file path, return it
    if (isFilePath(ref)) {
        return ref;
    }

    // Otherwise, look up in system fonts (preferredFamily first, then fontFamily)
    await buildSystemFontIndexes();
    const familyMap = primaryIndex!.get(ref.toLowerCase()) ?? secondaryIndex!.get(ref.toLowerCase());

    if (!familyMap) {
        throw new Error(`System font "${ref}" not found. Make sure it's installed.`);
    }

    // Map weight names to subfamily names
    const subfamilyNames: Record<string, string[]> = {
        regular: ['regular', 'normal', 'book', 'roman'],
        bold: ['bold', 'heavy', 'black'],
        italic: ['italic', 'oblique'],
        bolditalic: ['bold italic', 'bolditalic', 'bold oblique'],
    };

    const candidates = subfamilyNames[weight] || [weight];
    for (const candidate of candidates) {
        const path = familyMap.get(candidate);
        if (path) return path;
    }

    // Fallback: try to find any variant
    const available = Array.from(familyMap.keys());
    throw new Error(
        `Font "${ref}" found but weight "${weight}" not available. ` +
        `Available: ${available.join(', ')}`
    );
}

/**
 * FontManager - loads and manages fonts for text fitting
 */
export class FontManager {
    private fonts: { [family: string]: FontMap } = {};
    private defaultFamily: string = '';
    /** In-flight load promises to deduplicate concurrent requests */
    private pendingLoads: Map<string, Promise<Font>> = new Map();

    private constructor() {}

    /**
     * Create and initialize a FontManager.
     * If config is provided, validates all fonts exist before loading any.
     * If no config, creates an empty manager - use loadForTokens() to load fonts on demand.
     */
    static async create(config?: FontConfig): Promise<FontManager> {
        const manager = new FontManager();

        if (!config) {
            return manager;
        }

        // First pass: validate all fonts exist and resolve paths
        const resolved = new Map<string, Map<string, string>>();
        const errors: string[] = [];

        for (const [family, weights] of Object.entries(config)) {
            const familyPaths = new Map<string, string>();

            for (const [weight, ref] of Object.entries(weights)) {
                if (!ref) continue;
                try {
                    const path = await resolveFontPath(ref, weight);
                    familyPaths.set(weight, path);
                } catch (e: any) {
                    errors.push(`[${family}/${weight}] ${e.message}`);
                }
            }

            resolved.set(family, familyPaths);
        }

        if (errors.length > 0) {
            throw new Error(`Font validation failed:\n  ${errors.join('\n  ')}`);
        }

        // Second pass: load all fonts
        for (const [family, paths] of resolved) {
            const fontMap: FontMap = {};

            for (const [weight, path] of paths) {
                fontMap[weight] = await opentype.load(path);
            }

            manager.fonts[family] = fontMap;

            // Set first family as default
            if (!manager.defaultFamily) {
                manager.defaultFamily = family;
            }
        }

        return manager;
    }

    /**
     * Load all fonts required by the given tokens.
     * Extracts unique font/weight combinations and loads them.
     * Validates all fonts exist before loading (fail-fast).
     * Safe to call concurrently - duplicate loads are deduplicated.
     *
     * @param tokens - Array of tokens to scan for font requirements
     * @throws Error if any required font cannot be found
     */
    async loadForTokens(tokens: import('../types.js').Token[]): Promise<void> {
        // Extract unique font/weight combinations
        const required = new Map<string, Set<string>>();
        for (const token of tokens) {
            const familyKey = token.font.toLowerCase().replace(/\s+/g, '-');
            if (!required.has(familyKey)) {
                required.set(familyKey, new Set());
            }
            required.get(familyKey)!.add(token.weight);
        }

        // Build list of fonts to load (not already loaded or in-flight)
        const toResolve: Array<{ family: string; weight: string; originalName: string }> = [];
        const toAwait: Array<{ family: string; weight: string; promise: Promise<Font> }> = [];

        for (const [family, weights] of required) {
            for (const weight of weights) {
                // Already loaded?
                if (this.fonts[family]?.[weight]) {
                    continue;
                }

                const key = `${family}:${weight}`;

                // Already loading?
                const pending = this.pendingLoads.get(key);
                if (pending) {
                    toAwait.push({ family, weight, promise: pending });
                    continue;
                }

                // Need to load - find original font name for system font lookup
                const originalName = tokens.find(t =>
                    t.font.toLowerCase().replace(/\s+/g, '-') === family &&
                    t.weight === weight
                )?.font || family;

                toResolve.push({ family, weight, originalName });
            }
        }

        if (toResolve.length === 0 && toAwait.length === 0) {
            return; // All fonts already loaded
        }

        // First pass: resolve all paths and validate (fail-fast)
        const resolved: Array<{ family: string; weight: string; path: string }> = [];
        const errors: string[] = [];

        for (const { family, weight, originalName } of toResolve) {
            try {
                const path = await resolveFontPath(originalName, weight);
                resolved.push({ family, weight, path });
            } catch (e: any) {
                errors.push(`[${family}/${weight}] ${e.message}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Font validation failed:\n  ${errors.join('\n  ')}`);
        }

        // Second pass: load fonts (create promises and register in pendingLoads)
        for (const { family, weight, path } of resolved) {
            const key = `${family}:${weight}`;

            const loadPromise = opentype.load(path).then(font => {
                // Store in cache and clean up pending
                if (!this.fonts[family]) {
                    this.fonts[family] = {};
                }
                this.fonts[family][weight] = font;
                this.pendingLoads.delete(key);

                // Set first family as default if not set
                if (!this.defaultFamily) {
                    this.defaultFamily = family;
                }

                return font;
            }).catch(err => {
                this.pendingLoads.delete(key);
                throw err;
            });

            this.pendingLoads.set(key, loadPromise);
            toAwait.push({ family, weight, promise: loadPromise });
        }

        // Wait for all loads to complete
        await Promise.all(toAwait.map(({ promise }) => promise));
    }

    /**
     * Get font for a specific family and weight
     */
    getFont(family: string, weight: string): Font {
        const familyKey = family.toLowerCase().replace(/\s+/g, '-');
        const familyFonts = this.fonts[familyKey];

        if (!familyFonts) {
            throw new Error(`Font family "${family}" not loaded. Available: ${Object.keys(this.fonts).join(', ')}`);
        }

        const font = familyFonts[weight];
        if (!font) {
            throw new Error(`Font weight "${weight}" not found in family "${family}". Available: ${Object.keys(familyFonts).join(', ')}`);
        }
        return font;
    }

    /**
     * Get list of loaded family names
     */
    get families(): string[] {
        return Object.keys(this.fonts);
    }

    /**
     * Get list of weights for a family
     */
    getWeights(family: string): string[] {
        const familyFonts = this.fonts[family];
        return familyFonts ? Object.keys(familyFonts) : [];
    }

    /**
     * Get kerning lookup for a specific family and weight
     */
    getKerningLookup(family: string, weight: string): Map<string, number> {
        const font = this.getFont(family, weight);
        return buildKerningLookup(font);
    }

    /**
     * Get unitsPerEm for a specific family and weight
     */
    getUnitsPerEm(family: string, weight: string): number {
        const font = this.getFont(family, weight);
        return font.unitsPerEm;
    }
}
