import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const BASE_PATH = process.env.BASE_PATH ?? '';

export default {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter({
            fallback: '404.html',
            // fallback REQUIRED for SPA-style client-side routing on Pages.
            // MUST be '404.html' (Pages convention), NOT '200.html' (Netlify).
        }),
        paths: {
            base: BASE_PATH,
            relative: false,
            // relative: false is REQUIRED when combining `base` with a fallback —
            // otherwise deep-link refreshes resolve chunk URLs to wrong paths.
            // See sveltejs/kit#9341, discussion #11554.
        },
    },
};
