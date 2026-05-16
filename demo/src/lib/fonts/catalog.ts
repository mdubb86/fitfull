/**
 * Google Fonts catalog fetcher.
 *
 * Uses the undocumented `https://fonts.google.com/metadata/fonts` endpoint —
 * no API key required. Response is JSON prefixed with the XSSI guard `)]}'`
 * which must be stripped before parsing. We only consume the fields the demo
 * needs (`family`, `category`, `fonts`, `subsets`).
 *
 * See `docs/superpowers/research/2026-05-16-google-fonts.md` § 1.
 */

export interface FontFamily {
    /** Human-readable family name, e.g. "Inter" or "Source Sans 3". */
    family: string;
    /** "sans-serif" | "serif" | "display" | "handwriting" | "monospace". */
    category: string;
    /** Numeric weights with a normal style, e.g. [400, 500, 700]. */
    variants: number[];
    /** Numeric weights with an italic counterpart, e.g. [400, 700]. */
    italicVariants?: number[];
    /** Subsets present in the catalog, e.g. ["latin", "latin-ext", "cyrillic"]. */
    subsets?: string[];
}

interface RawFamily {
    family: string;
    category: string;
    subsets?: string[];
    fonts?: Record<string, unknown>;
}

interface RawMetadata {
    familyMetadataList?: RawFamily[];
}

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
const XSSI_PREFIX = ")]}'";

let cached: FontFamily[] | null = null;
let pending: Promise<FontFamily[]> | null = null;

function parseFamilyKeys(fonts: Record<string, unknown> | undefined): {
    variants: number[];
    italicVariants: number[];
} {
    const variantsSet = new Set<number>();
    const italicSet = new Set<number>();
    if (!fonts) return { variants: [], italicVariants: [] };
    for (const key of Object.keys(fonts)) {
        // Keys look like "400" (normal) or "400i" (italic).
        const isItalic = key.endsWith('i');
        const weightStr = isItalic ? key.slice(0, -1) : key;
        const weight = Number.parseInt(weightStr, 10);
        if (!Number.isFinite(weight)) continue;
        if (isItalic) italicSet.add(weight);
        else variantsSet.add(weight);
    }
    return {
        variants: [...variantsSet].sort((a, b) => a - b),
        italicVariants: [...italicSet].sort((a, b) => a - b),
    };
}

async function fetchCatalog(): Promise<FontFamily[]> {
    const res = await fetch(METADATA_URL);
    if (!res.ok) throw new Error(`google fonts catalog: HTTP ${res.status}`);
    const text = await res.text();
    const json = text.startsWith(XSSI_PREFIX) ? text.slice(XSSI_PREFIX.length) : text;
    const data = JSON.parse(json) as RawMetadata;

    const raw = data.familyMetadataList ?? [];
    const out: FontFamily[] = [];
    for (const f of raw) {
        const subsets = f.subsets ?? [];
        // v1 is latin-only — drop families that don't have a latin subset.
        if (!subsets.includes('latin')) continue;
        const { variants, italicVariants } = parseFamilyKeys(f.fonts);
        if (variants.length === 0 && italicVariants.length === 0) continue;
        out.push({
            family: f.family,
            category: f.category,
            variants,
            italicVariants: italicVariants.length > 0 ? italicVariants : undefined,
            subsets,
        });
    }
    out.sort((a, b) => a.family.localeCompare(b.family));
    return out;
}

/**
 * Fetch the Google Fonts catalog (filtered to latin, sorted alphabetically).
 *
 * Result is module-scope cached after the first successful fetch. Concurrent
 * callers share the same in-flight promise.
 */
export async function getCatalog(): Promise<FontFamily[]> {
    if (cached) return cached;
    if (pending) return pending;
    pending = fetchCatalog()
        .then((list) => {
            cached = list;
            return list;
        })
        .finally(() => {
            pending = null;
        });
    return pending;
}
