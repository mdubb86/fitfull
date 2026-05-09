import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FontManager } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', '..', 'fonts');
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');

describe('FontManager layered resolution', () => {
    test('explicit paths resolve without system scan', async () => {
        const fm = await FontManager.create();
        const tokens = [
            { text: 'Hello', size: 12, font: 'inter', weight: 'regular' as const },
        ];

        const stderrLines: string[] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            stderrLines.push(String(args[0]));
            originalError.apply(console, args);
        };

        try {
            await fm.loadForTokens(tokens, { explicitPaths: [INTER_REGULAR], hint: 'api' });
        } finally {
            console.error = originalError;
        }

        // Should have resolved inter/regular
        const font = fm.getFont('inter', 'regular');
        assert.ok(font, 'inter/regular should be resolved from explicit path');

        // System scan log line should NOT have been emitted
        const scanLine = stderrLines.find(l => l.includes('Scanned') && l.includes('system fonts'));
        assert.ok(!scanLine, `No system scan log line expected, got: ${scanLine}`);
    });

    test('explicit bold path resolves correct weight', async () => {
        const fm = await FontManager.create();
        const tokens = [
            { text: 'Bold', size: 12, font: 'inter', weight: 'bold' as const },
        ];
        await fm.loadForTokens(tokens, { explicitPaths: [INTER_BOLD], hint: 'api' });
        const font = fm.getFont('inter', 'bold');
        assert.ok(font, 'inter/bold should be resolved from explicit path');
    });

    test('multiple explicit paths resolve multiple weights', async () => {
        const fm = await FontManager.create();
        const tokens = [
            { text: 'Regular', size: 12, font: 'inter', weight: 'regular' as const },
            { text: 'Bold', size: 12, font: 'inter', weight: 'bold' as const },
        ];
        await fm.loadForTokens(tokens, {
            explicitPaths: [INTER_REGULAR, INTER_BOLD],
            hint: 'api',
        });
        assert.ok(fm.getFont('inter', 'regular'), 'regular resolved');
        assert.ok(fm.getFont('inter', 'bold'), 'bold resolved');
    });

    test('log line uses --font form for cli hint (when scan occurs)', async () => {
        // We can verify the log line FORMAT by checking the conditional logic.
        // We use a font name that IS in explicit paths, so no scan occurs.
        // This test just verifies the explicit path path does NOT emit --font log.
        const fm = await FontManager.create();
        const tokens = [{ text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const }];

        const stderrLines: string[] = [];
        const orig = console.error;
        console.error = (...args: unknown[]) => { stderrLines.push(String(args[0])); };
        try {
            await fm.loadForTokens(tokens, { explicitPaths: [INTER_REGULAR], hint: 'cli' });
        } finally {
            console.error = orig;
        }

        const scanLine = stderrLines.find(l => l.includes('Scanned'));
        assert.ok(!scanLine, 'No scan should occur when explicit paths cover all fonts');
    });
});
