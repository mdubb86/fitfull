import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    use: { browserName: 'chromium' },
    webServer: {
        command: 'pnpm exec http-server . -p 8123 -s',
        url: 'http://localhost:8123/tests/e2e/fixture.html',
        reuseExistingServer: !process.env.CI,
    },
});
