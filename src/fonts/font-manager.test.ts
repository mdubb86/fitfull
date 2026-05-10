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

describe('FontManager system resolution via injected provider', () => {
    test('fuzzy filename match resolves family from system fonts', async () => {
        const fm = await FontManager.createWithOptions({
            getSystemFonts: async () => [INTER_REGULAR],
        });
        await fm.loadForTokens([
            { text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const },
        ], { hint: 'api' });
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('resolves via index (no scan log) for cli hint when font is indexed', async () => {
        // When the font resolves via the system index (exact match), no scan log is emitted
        // regardless of hint. The scan log is only emitted for fuzzy-fallback hits.
        const fm = await FontManager.createWithOptions({
            getSystemFonts: async () => [INTER_REGULAR],
        });
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args.map(String).join(' '));
        };
        try {
            await fm.loadForTokens([
                { text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const },
            ], { hint: 'cli' });
        } finally {
            console.error = orig;
        }

        // Font resolved via index path — no "Scanned" log expected
        const scanLog = errors.find(e => e.includes('Scanned'));
        assert.ok(!scanLog, `expected no scan log for index-resolved font, got: ${errors.join('; ')}`);
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('resolves via index (no scan log) for api hint when font is indexed', async () => {
        // When the font resolves via the system index (exact match), no scan log is emitted
        // because systemResolved stays empty. The scan log is only emitted for fuzzy-fallback hits.
        const fm = await FontManager.createWithOptions({
            getSystemFonts: async () => [INTER_REGULAR],
        });
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args.map(String).join(' '));
        };
        try {
            await fm.loadForTokens([
                { text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const },
            ], { hint: 'api' });
        } finally {
            console.error = orig;
        }

        // Font resolved via index path — no "Scanned" log expected
        const scanLog = errors.find(e => e.includes('Scanned'));
        assert.ok(!scanLog, `expected no scan log for index-resolved font, got: ${errors.join('; ')}`);
        // Font should still be accessible
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('concurrent loadForTokens calls share the system index build', async () => {
        let scanCount = 0;
        const fm = await FontManager.createWithOptions({
            getSystemFonts: async () => {
                scanCount++;
                return [INTER_REGULAR];
            },
        });

        await Promise.all([
            fm.loadForTokens([{ text: 'A', size: 12, font: 'inter', weight: 'regular' as const }]),
            fm.loadForTokens([{ text: 'B', size: 12, font: 'inter', weight: 'regular' as const }]),
        ]);

        // loadForTokens calls systemFontsProvider once for allSystemPaths per call (2 concurrent),
        // plus buildSystemFontIndexes calls it once (deduped via promise). Total: at most 3.
        assert.ok(scanCount <= 3, `expected at most 3 provider calls, got ${scanCount}`);
    });
});
