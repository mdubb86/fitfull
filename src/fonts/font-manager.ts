import * as fontkit from 'fontkit';
import type { Font } from 'fontkit';
import getSystemFontsModule from 'get-system-fonts';

// Handle both ESM default export and CommonJS
const getSystemFonts = (getSystemFontsModule as any).default ?? getSystemFontsModule;
import type { FontMap } from '../types.js';
import type { FontWeight } from '../types.js';
import type { FontConfig } from './types.js';
import { normalizeFamily } from './normalize.js';
import pMap from 'p-map';
import fuzzysort from 'fuzzysort';
import { basename, extname } from 'node:path';
import { performance } from 'node:perf_hooks';


/** Load a single font face from a file path (not collection-aware; returns first face). */
function loadFont(fontPath: string): fontkit.Font | null {
    try {
        const result = fontkit.openSync(fontPath);
        if ('fonts' in result) {
            return (result as fontkit.FontCollection).fonts[0] ?? null;
        }
        return result as fontkit.Font;
    } catch {
        return null;
    }
}

/**
 * Load a font from an indexed path (may be "path#postscriptName" for collections).
 * Returns the specific face from a TTC, or the single font otherwise.
 */
function loadFontFromIndexedPath(indexedPath: string): fontkit.Font | null {
    const hashIdx = indexedPath.lastIndexOf('#');
    if (hashIdx !== -1) {
        const filePath = indexedPath.slice(0, hashIdx);
        const postscriptName = indexedPath.slice(hashIdx + 1);
        try {
            const result = fontkit.openSync(filePath);
            if ('fonts' in result) {
                const collection = result as fontkit.FontCollection;
                const face = collection.getFont(postscriptName);
                return face ?? collection.fonts[0] ?? null;
            }
            return result as fontkit.Font;
        } catch {
            return null;
        }
    }
    return loadFont(indexedPath);
}

function normalizeForMatch(s: string): string {
    return s.toLowerCase().replace(/[\s\-_]/g, '');
}

/** Map subfamily strings to canonical token weight keys */
const subfamilyToWeight: Record<string, string> = {
    regular: 'regular',
    normal: 'regular',
    book: 'regular',
    roman: 'regular',
    bold: 'bold',
    heavy: 'bold',
    black: 'bold',
    italic: 'italic',
    oblique: 'italic',
    'bold italic': 'bolditalic',
    bolditalic: 'bolditalic',
    'bold oblique': 'bolditalic',
};

/**
 * Find a font family in system fonts using fuzzy pre-filter then full scan fallback.
 */
async function findInSystemFonts(
    family: string,
    allPaths: string[]
): Promise<string | null> {
    const normalizedFamily = normalizeForMatch(family);

    // Layer 2: fuzzy filename pre-filter
    const candidates = fuzzysort
        .go(normalizedFamily, allPaths, {
            key: (p: string) => normalizeForMatch(basename(p, extname(p))),
            threshold: -1000,
            limit: 10,
        })
        .map((r) => r.obj);

    for (const candidate of candidates) {
        const font = loadFont(candidate);
        if (!font) continue;
        const ff = String(font.familyName || '').toLowerCase();
        if (ff === family) return candidate;
    }

    // Layer 3: full scan fallback — check remaining paths
    const candidateSet = new Set(candidates);
    const remaining = allPaths.filter((p) => !candidateSet.has(p));
    for (const fontPath of remaining) {
        const font = loadFont(fontPath);
        if (!font) continue;
        const ff = String(font.familyName || '').toLowerCase();
        if (ff === family) return fontPath;
    }

    return null;
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
 * Resolve a font reference (path or name) to an actual file path given pre-built indexes.
 * Returns null if the family is not found in the system index (instead of throwing),
 * so callers can fall through to findInSystemFonts as a fuzzy fallback.
 */
function resolveFontPathFromIndex(
    ref: string,
    weight: string,
    index: Map<string, Map<string, string>>,
): string | null {
    const familyMap = index.get(ref.toLowerCase());

    if (!familyMap) {
        return null;
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
    /** In-flight load promises to deduplicate concurrent requests */
    private pendingLoads: Map<string, Promise<Font>> = new Map();
    private readonly systemFontsProvider: () => Promise<string[]>;

    /** Per-instance system font index cache (keyed on familyName) */
    private index: Map<string, Map<string, string>> | null = null;
    private indexPromise: Promise<void> | null = null;

    private constructor(systemFontsProvider?: () => Promise<string[]>) {
        this.systemFontsProvider = systemFontsProvider ?? getSystemFonts;
    }

    /**
     * Build index of system fonts by loading and parsing each one.
     * Keyed on familyName (fontkit direct property).
     * Safe to call concurrently — deduplicates via shared promise.
     */
    private async buildSystemFontIndexes(): Promise<void> {
        if (this.index) return;
        if (this.indexPromise) return this.indexPromise;

        this.indexPromise = (async () => {
            const index = new Map<string, Map<string, string>>();
            const paths = await this.systemFontsProvider();

            const addFace = (font: fontkit.Font, indexedPath: string) => {
                const family = String(font.familyName || '').toLowerCase();
                const subfamily = String(font.subfamilyName || 'regular').toLowerCase();
                if (!family) return;
                if (!index.has(family)) {
                    index.set(family, new Map());
                }
                index.get(family)!.set(subfamily, indexedPath);
            };

            await pMap(paths, async (fontPath: string) => {
                try {
                    const result = fontkit.openSync(fontPath);
                    if ('fonts' in result) {
                        // FontCollection: enumerate each face
                        const collection = result as fontkit.FontCollection;
                        for (const face of collection.fonts) {
                            const indexedPath = `${fontPath}#${face.postscriptName}`;
                            addFace(face, indexedPath);
                        }
                    } else {
                        addFace(result as fontkit.Font, fontPath);
                    }
                } catch {
                    // skip unreadable fonts
                }
            }, { concurrency: 32 });

            this.index = index;
        })();

        return this.indexPromise;
    }

    /**
     * Ensure the system font index is built.
     */
    private async ensureSystemIndex(): Promise<void> {
        return this.buildSystemFontIndexes();
    }

    /**
     * Resolve a font reference (path or name) to an actual file path.
     * Returns null if the family is not found in the system index,
     * so callers can fall through to findInSystemFonts as a fuzzy fallback.
     */
    private async resolveFontPath(ref: string, weight: string): Promise<string | null> {
        if (isFilePath(ref)) {
            return ref;
        }
        await this.ensureSystemIndex();
        return resolveFontPathFromIndex(ref, weight, this.index!);
    }

    /**
     * Create and initialize a FontManager.
     * If config is provided, validates all fonts exist before loading any.
     * If no config, creates an empty manager - use loadForTokens() to load fonts on demand.
     */
    static async create(config?: FontConfig): Promise<FontManager> {
        const manager = new FontManager();
        if (config) {
            await manager.loadConfigs(config);
        }
        return manager;
    }

    /**
     * Create a FontManager with advanced options including font config and an
     * optional system font provider override (primarily for testing).
     * Most consumers should use FontManager.create() instead.
     */
    static async createWithOptions(options: {
        fonts?: FontConfig;
        getSystemFonts?: () => Promise<string[]>;
    }): Promise<FontManager> {
        const fm = new FontManager(options.getSystemFonts);
        if (options.fonts) {
            await fm.loadConfigs(options.fonts);
        }
        return fm;
    }

    private async loadConfigs(config: FontConfig): Promise<void> {
        // First pass: validate all fonts exist and resolve paths
        const resolved = new Map<string, Map<string, string>>();
        const errors: string[] = [];

        for (const [family, weights] of Object.entries(config)) {
            const familyPaths = new Map<string, string>();

            for (const [weight, ref] of Object.entries(weights)) {
                if (!ref) continue;
                try {
                    const path = await this.resolveFontPath(ref, weight);
                    if (path === null) {
                        errors.push(`[${family}/${weight}] System font "${ref}" not found. Make sure it's installed.`);
                    } else {
                        familyPaths.set(weight, path);
                    }
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
                const loaded = loadFontFromIndexedPath(path);
                if (!loaded) throw new Error(`Failed to load font: ${path}`);
                fontMap[weight] = loaded;
            }

            this.fonts[family] = fontMap;
        }
    }

    /**
     * Load all fonts required by the given tokens.
     * Extracts unique font/weight combinations and loads them.
     * Validates all fonts exist before loading (fail-fast).
     * Safe to call concurrently - duplicate loads are deduplicated.
     *
     * @param tokens - Array of tokens to scan for font requirements
     * @param options - Optional explicit font paths (Layer 1) and hint for log messages
     * @throws Error if any required font cannot be found
     */
    async loadForTokens(
        tokens: import('../types.js').Token[],
        options: { explicitPaths?: string[]; hint?: 'cli' | 'api' } = {}
    ): Promise<void> {
        const { explicitPaths = [], hint = 'api' } = options;

        // Layer 1: register explicit font files directly
        const failedPaths: string[] = [];
        for (const fontPath of explicitPaths) {
            const font = loadFont(fontPath);
            if (!font) {
                failedPaths.push(fontPath);
                continue;
            }
            const family = normalizeFamily(String(font.familyName || ''));
            const subfamilyRaw = String(font.subfamilyName || 'regular').toLowerCase();
            const weight = subfamilyToWeight[subfamilyRaw] ?? 'regular';
            if (!family) continue;
            if (!this.fonts[family]) this.fonts[family] = {};
            this.fonts[family][weight] = font;
        }
        if (failedPaths.length > 0) {
            console.error(
                `[fitfull] Could not load ${failedPaths.length} explicit font file(s):\n` +
                failedPaths.map(p => `  ${p}`).join('\n')
            );
        }

        // Extract unique font/weight combinations
        const required = new Map<string, Set<string>>();
        for (const token of tokens) {
            const familyKey = normalizeFamily(token.font);
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
                    normalizeFamily(t.font) === family &&
                    t.weight === weight
                )?.font || family;

                toResolve.push({ family, weight, originalName });
            }
        }

        if (toResolve.length === 0 && toAwait.length === 0) {
            return; // All fonts already loaded (including via Layer 1)
        }

        // Fetch all system font paths once — needed as fallback for findInSystemFonts (Layer 2+3)
        const allSystemPaths = await this.systemFontsProvider();

        // First pass: resolve all paths and validate (fail-fast)
        // Layer 2: exact match via system index; Layer 3: fuzzy fallback via findInSystemFonts
        const resolved: Array<{ family: string; weight: string; path: string }> = [];
        const errors: string[] = [];
        const systemResolved: Array<{ family: string; path: string }> = [];
        const scanStart = performance.now();

        for (const { family, weight, originalName } of toResolve) {
            try {
                // Try exact-match via system index first
                let resolvedPath = await this.resolveFontPath(originalName, weight);
                if (!resolvedPath) {
                    // Fuzzy fallback: try filename pre-filter then full scan
                    resolvedPath = await findInSystemFonts(originalName.toLowerCase(), allSystemPaths);
                }
                if (resolvedPath) {
                    resolved.push({ family, weight, path: resolvedPath });
                    // Track any font resolved via the system scan (index or fuzzy fallback)
                    systemResolved.push({ family, path: resolvedPath });
                } else {
                    errors.push(`[${family}/${weight}] Font "${originalName}" not found. Make sure it's installed or pass the font file path directly.`);
                }
            } catch (e: any) {
                errors.push(`[${family}/${weight}] ${e.message}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Font validation failed:\n  ${errors.join('\n  ')}`);
        }

        if (systemResolved.length > 0) {
            const elapsed = (performance.now() - scanStart).toFixed(1);
            const pathLines = hint === 'cli'
                ? systemResolved.map(r => `  --font ${r.path}`).join('\n')
                : `  fonts: [${systemResolved.map(r => `"${r.path}"`).join(', ')}]`;
            console.error(
                `[fitfull] Scanned ${allSystemPaths.length} system fonts to resolve ` +
                `${systemResolved.length} ${systemResolved.length === 1 ? 'family' : 'families'} ` +
                `(${elapsed}ms). Add these to skip next time:\n${pathLines}`
            );
        }

        // Second pass: load fonts (sync with fontkit, wrap in resolved promise for API compatibility)
        for (const { family, weight, path } of resolved) {
            const key = `${family}:${weight}`;

            const loadPromise = (async () => {
                const font = loadFontFromIndexedPath(path);
                if (!font) throw new Error(`Failed to load font: ${path}`);
                if (!this.fonts[family]) {
                    this.fonts[family] = {};
                }
                this.fonts[family][weight] = font;
                this.pendingLoads.delete(key);
                return font;
            })().catch(err => {
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
        const familyKey = normalizeFamily(family);
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
     * Get unitsPerEm for a specific family and weight
     */
    getUnitsPerEm(family: string, weight: string): number {
        const font = this.getFont(family, weight);
        return font.unitsPerEm;
    }
}
