// Slimmed Google Fonts catalog provided by the `fitfull-fonts-catalog`
// Vite plugin (demo/vite.config.ts).
declare module 'virtual:fonts-catalog' {
    const catalog: Array<{
        family: string;
        category: string;
        variants: number[];
        italicVariants?: number[];
    }>;
    export default catalog;
}

// fitfull package.json version injected by Vite's `define` in vite.config.ts.
declare const __FITFULL_VERSION__: string;
