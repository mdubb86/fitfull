import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
    preprocess: vitePreprocess(),
    kit: {
        // fallback HTML is REQUIRED so client-side routing works on deep-link
        // refreshes (the static host serves it when no file matches).
        adapter: adapter({ fallback: '404.html' }),
    },
};
