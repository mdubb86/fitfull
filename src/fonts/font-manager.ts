import opentype, { Font } from 'opentype.js';
import getSystemFontsModule from 'get-system-fonts';

// Handle both ESM default export and CommonJS
const getSystemFonts = (getSystemFontsModule as any).default ?? getSystemFontsModule;
import type { FontMap } from '../types.js';
import type { FontWeight } from '../types.js';
import type { FontConfig } from './types.js';
import { buildKerningLookup } from './font-metrics.js';
import { normalizeFamily } from './normalize.js';
import pMap from 'p-map';
import fuzzysort from 'fuzzysort';
import { basename, extname } from 'node:path';
import { performance } from 'node:perf_hooks';

// Helper to safely get string from font name table entry
function getNameString(entry: unknown): string {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object' && 'en' in entry) {
        const en = (entry as { en: unknown }).en;
        return typeof en === 'string' ? en : '';
    }
    return '';
}

async function loadFont(fontPath: string): Promise<opentype.Font | null> {
    try {
        return await opentype.load(fontPath);
    } catch {
        return null;
    }
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
        if (candidate.toLowerCase().endsWith('.ttc')) continue;
        const font = await loadFont(candidate);
        if (!font) continue;
        const pf = getNameString((font.names as any).preferredFamily).toLowerCase();
        const ff = getNameString(font.names.fontFamily).toLowerCase();
        if (pf === family || ff === family) return candidate;
    }

    // Layer 3: full scan fallback — check remaining paths
    const candidateSet = new Set(candidates);
    const remaining = allPaths.filter(
        (p) => !candidateSet.has(p) && !p.toLowerCase().endsWith('.ttc')
    );
    for (const fontPath of remaining) {
        const font = await loadFont(fontPath);
        if (!font) continue;
        const pf = getNameString((font.names as any).preferredFamily).toLowerCase();
        const ff = getNameString(font.names.fontFamily).toLowerCase();
        if (pf === family || ff === family) return fontPath;
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
    primaryIndex: Map<string, Map<string, string>>,
    secondaryIndex: Map<string, Map<string, string>>,
): string | null {
    const familyMap = primaryIndex.get(ref.toLowerCase()) ?? secondaryIndex.get(ref.toLowerCase());

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

    /** Per-instance system font index cache */
    private primaryIndex: Map<string, Map<string, string>> | null = null;
    private secondaryIndex: Map<string, Map<string, string>> | null = null;
    private indexPromise: Promise<void> | null = null;

    private constructor(systemFontsProvider?: () => Promise<string[]>) {
        this.systemFontsProvider = systemFontsProvider ?? getSystemFonts;
    }

    /**
     * Build indexes of system fonts by loading and parsing each one.
     * Primary index uses preferredFamily (Name ID 16) — matches CSS font-family names.
     * Secondary index uses fontFamily (Name ID 1) — the internal font name.
     * Safe to call concurrently — deduplicates via shared promise.
     */
    private async buildSystemFontIndexes(): Promise<void> {
        if (this.primaryIndex) return;
        if (this.indexPromise) return this.indexPromise;

        this.indexPromise = (async () => {
            const primary = new Map<string, Map<string, string>>();
            const secondary = new Map<string, Map<string, string>>();
            const paths = await this.systemFontsProvider();

            const filteredPaths = paths.filter((p: string) => !p.toLowerCase().endsWith('.ttc'));

            await pMap(filteredPaths, async (fontPath: string) => {
                const font = await loadFont(fontPath);
                if (!font) return;

                const preferredFamily = getNameString((font.names as any).preferredFamily).toLowerCase();
                const family = getNameString(font.names.fontFamily).toLowerCase();
                const subfamily = (getNameString(font.names.fontSubfamily) || 'regular').toLowerCase();

                if (preferredFamily) {
                    if (!primary.has(preferredFamily)) {
                        primary.set(preferredFamily, new Map());
                    }
                    primary.get(preferredFamily)!.set(subfamily, fontPath);
                }

                if (family) {
                    if (!secondary.has(family)) {
                        secondary.set(family, new Map());
                    }
                    secondary.get(family)!.set(subfamily, fontPath);
                }
            }, { concurrency: 32 });

            this.primaryIndex = primary;
            this.secondaryIndex = secondary;
        })();

        return this.indexPromise;
    }

    /**
     * Ensure the system font index is built.
     * Warn suppression is handled by the caller so that opentype.js warnings
     * are silenced for the entire system-scan phase.
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
        return resolveFontPathFromIndex(ref, weight, this.primaryIndex!, this.secondaryIndex!);
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
                fontMap[weight] = await opentype.load(path);
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
            const font = await loadFont(fontPath);
            if (!font) {
                failedPaths.push(fontPath);
                continue;
            }
            const family = (
                getNameString((font.names as any).preferredFamily) ||
                getNameString(font.names.fontFamily)
            ).toLowerCase();
            const subfamilyRaw = (getNameString(font.names.fontSubfamily) || 'regular').toLowerCase();
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

        // Suppress opentype.js console.warn for all system font loading (index build + fuzzy scan)
        const originalWarn = console.warn;
        console.warn = () => {};
        try {
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
        } finally {
            console.warn = originalWarn;
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
