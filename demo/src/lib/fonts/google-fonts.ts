/**
 * Google Fonts CSS API → WOFF2 byte fetcher.
 *
 * Hits `https://fonts.googleapis.com/css2`, picks the latin `@font-face`
 * block, and downloads the WOFF2 from `fonts.gstatic.com`. Both origins send
 * `access-control-allow-origin: *`, so `fetch().arrayBuffer()` works without
 * a CORS proxy.
 *
 * Note on User-Agent: the CSS endpoint serves a different `format()` based on
 * the requester's UA — modern browsers get WOFF2, old IE gets EOT/TTF. From a
 * real browser this happens automatically, but for SSR / Node we send an
 * explicit Chrome UA defensively. The browser may strip the header (it's on
 * the forbidden list) — that's fine since the browser's own UA already maps
 * to WOFF2.
 *
 * See `docs/superpowers/research/2026-05-16-google-fonts.md` § 2.
 */
import type { FontWeight } from 'fitfull';

const CSS_BASE = 'https://fonts.googleapis.com/css2';

/** A modern Chrome UA — only used outside the browser; browsers ignore this header. */
const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function weightSpec(weight: FontWeight): string {
    switch (weight) {
        case 'regular':
            return 'wght@400';
        case 'bold':
            return 'wght@700';
        case 'italic':
            return 'ital,wght@1,400';
        case 'bolditalic':
            return 'ital,wght@1,700';
    }
}

function buildCssUrl(family: string, weight: FontWeight): string {
    // Google Fonts CSS2 accepts `+` for spaces; encodeURIComponent uses %20.
    // Both work, but `+` matches the canonical examples.
    const fam = family.trim().replace(/\s+/g, '+');
    return `${CSS_BASE}?family=${fam}:${weightSpec(weight)}&display=swap`;
}

/** Extract the latin (or single) @font-face block's WOFF2 URL from CSS text. */
function extractLatinUrl(css: string): string | null {
    // Capture `/* subset */` comment then the immediately following @font-face body.
    const blockRe = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
    const blocks: { subset: string; body: string }[] = [];
    for (const m of css.matchAll(blockRe)) {
        blocks.push({ subset: m[1], body: m[2] });
    }

    const urlRe = /url\(\s*['"]?(https:\/\/fonts\.gstatic\.com\/[^)'"\s]+\.woff2)['"]?\s*\)/;

    if (blocks.length === 0) {
        // Some responses have no subset comments (rare — older or single-subset families).
        // Just pull the first WOFF2 url from the whole document.
        return css.match(urlRe)?.[1] ?? null;
    }

    const latin = blocks.find((b) => b.subset === 'latin') ?? blocks[0];
    return latin.body.match(urlRe)?.[1] ?? null;
}

/**
 * Fetch the WOFF2 bytes for `${family}:${weight}` from Google Fonts.
 *
 * Does NOT cache — compose with `getFontBytes` from `./cache.ts` at the call
 * site if persistence is desired:
 *
 * ```ts
 * const bytes = await getFontBytes(family, weight, () => fetchFontBytes(family, weight));
 * ```
 */
export async function fetchFontBytes(
    family: string,
    weight: FontWeight,
): Promise<ArrayBuffer> {
    const cssUrl = buildCssUrl(family, weight);
    const cssRes = await fetch(cssUrl, {
        headers: { 'User-Agent': CHROME_UA },
    });
    if (!cssRes.ok) {
        throw new Error(
            `Font '${family}' weight '${weight}' not available on Google Fonts ` +
                `(css2 HTTP ${cssRes.status})`,
        );
    }
    const css = await cssRes.text();
    const woff2Url = extractLatinUrl(css);
    if (!woff2Url) {
        throw new Error(
            `Font '${family}' weight '${weight}' not available on Google Fonts ` +
                `(no WOFF2 URL in CSS response)`,
        );
    }

    const bytesRes = await fetch(woff2Url);
    if (!bytesRes.ok) {
        throw new Error(
            `Font '${family}' weight '${weight}': failed to download bytes ` +
                `(gstatic HTTP ${bytesRes.status})`,
        );
    }
    return bytesRes.arrayBuffer();
}
