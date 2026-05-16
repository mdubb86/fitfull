import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * `virtual:fonts-catalog` — slimmed Google Fonts catalog imported sync at
 * build/dev time from the `google-font-metadata` npm package. The raw package
 * data is ~41MB; we keep only what the picker needs (family, category,
 * variants, italicVariants) which is ~180KB for ~1900 families.
 *
 * The browser can't fetch fonts.google.com/metadata/fonts directly (no CORS),
 * so the alternative would be a same-origin static asset + a build script.
 * Doing it as a virtual module collapses both into one Vite hook.
 */
function fontsCatalogPlugin(): Plugin {
    const id = 'virtual:fonts-catalog';
    const resolved = '\0' + id;
    return {
        name: 'fitfull-fonts-catalog',
        resolveId(source) {
            if (source === id) return resolved;
        },
        async load(loaded) {
            if (loaded !== resolved) return;
            const { APIv2 } = await import('google-font-metadata');
            const out: Array<{
                family: string;
                category: string;
                variants: number[];
                italicVariants?: number[];
            }> = [];
            for (const f of Object.values(APIv2 as Record<string, any>)) {
                const subsets: string[] = f.subsets ?? [];
                if (!subsets.includes('latin')) continue;

                const variants: number[] = [];
                const italicVariants: number[] = [];
                const weights: number[] = f.weights ?? [];
                const styles: string[] = f.styles ?? [];
                for (const w of weights) {
                    if (styles.includes('normal')) variants.push(w);
                    if (styles.includes('italic')) italicVariants.push(w);
                }
                if (variants.length === 0 && italicVariants.length === 0) continue;

                const entry: (typeof out)[number] = {
                    family: f.family,
                    category: f.category,
                    variants: variants.sort((a, b) => a - b),
                };
                if (italicVariants.length > 0) {
                    entry.italicVariants = italicVariants.sort((a, b) => a - b);
                }
                out.push(entry);
            }
            out.sort((a, b) => a.family.localeCompare(b.family));
            return `export default ${JSON.stringify(out)};`;
        },
    };
}

export default defineConfig({
    plugins: [fontsCatalogPlugin(), tailwindcss(), sveltekit()],
});
