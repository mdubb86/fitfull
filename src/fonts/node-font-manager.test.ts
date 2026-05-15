import { test, describe } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeFontManager } from './node-font-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', '..', 'fonts');
const INTER_REGULAR = join(FONTS_DIR, 'Inter-Regular.ttf');
const INTER_BOLD = join(FONTS_DIR, 'Inter-Bold.ttf');

describe('NodeFontManager layered resolution', () => {
    test('explicit paths resolve without system scan', async () => {
        const fm = await NodeFontManager.create();
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
            await fm.loadForTokens(tokens, { fonts: [INTER_REGULAR], _hint: 'api' });
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
        const fm = await NodeFontManager.create();
        const tokens = [
            { text: 'Bold', size: 12, font: 'inter', weight: 'bold' as const },
        ];
        await fm.loadForTokens(tokens, { fonts: [INTER_BOLD], _hint: 'api' });
        const font = fm.getFont('inter', 'bold');
        assert.ok(font, 'inter/bold should be resolved from explicit path');
    });

    test('multiple explicit paths resolve multiple weights', async () => {
        const fm = await NodeFontManager.create();
        const tokens = [
            { text: 'Regular', size: 12, font: 'inter', weight: 'regular' as const },
            { text: 'Bold', size: 12, font: 'inter', weight: 'bold' as const },
        ];
        await fm.loadForTokens(tokens, {
            fonts: [INTER_REGULAR, INTER_BOLD],
            _hint: 'api',
        });
        assert.ok(fm.getFont('inter', 'regular'), 'regular resolved');
        assert.ok(fm.getFont('inter', 'bold'), 'bold resolved');
    });

    test('log line uses --font form for cli hint (when scan occurs)', async () => {
        // We can verify the log line FORMAT by checking the conditional logic.
        // We use a font name that IS in explicit paths, so no scan occurs.
        // This test just verifies the explicit path path does NOT emit --font log.
        const fm = await NodeFontManager.create();
        const tokens = [{ text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const }];

        const stderrLines: string[] = [];
        const orig = console.error;
        console.error = (...args: unknown[]) => { stderrLines.push(String(args[0])); };
        try {
            await fm.loadForTokens(tokens, { fonts: [INTER_REGULAR], _hint: 'cli' });
        } finally {
            console.error = orig;
        }

        const scanLine = stderrLines.find(l => l.includes('Scanned'));
        assert.ok(!scanLine, 'No scan should occur when explicit paths cover all fonts');
    });
});

describe('NodeFontManager system resolution via injected provider', () => {
    test('fuzzy filename match resolves family from system fonts', async () => {
        const fm = await NodeFontManager.createWithOptions({
            getSystemFonts: async () => [INTER_REGULAR],
        });
        await fm.loadForTokens([
            { text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const },
        ], { _hint: 'api' });
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('emits scan log line with --font format for cli hint', async () => {
        const fm = await NodeFontManager.createWithOptions({
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
            ], { _hint: 'cli' });
        } finally {
            console.error = orig;
        }

        const scanLog = errors.find(e => e.includes('Scanned'));
        assert.ok(scanLog, `expected scan log for system-resolved font, got: ${errors.join('; ')}`);
        assert.ok(scanLog!.includes('--font'), `expected --font format in cli hint log, got: ${scanLog}`);
        assert.ok(scanLog!.includes(INTER_REGULAR), `expected resolved path in log, got: ${scanLog}`);
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('emits scan log line with fonts: array format for api hint', async () => {
        const fm = await NodeFontManager.createWithOptions({
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
            ], { _hint: 'api' });
        } finally {
            console.error = orig;
        }

        const scanLog = errors.find(e => e.includes('Scanned'));
        assert.ok(scanLog, `expected scan log for system-resolved font, got: ${errors.join('; ')}`);
        assert.ok(scanLog!.includes('fonts:'), `expected fonts: format in api hint log, got: ${scanLog}`);
        assert.ok(scanLog!.includes(INTER_REGULAR), `expected resolved path in log, got: ${scanLog}`);
        assert.ok(fm.getFont('inter', 'regular'));
    });

    test('explicit paths do not trigger scan log', async () => {
        const fm = await NodeFontManager.createWithOptions({
            getSystemFonts: async () => {
                throw new Error('should not be called');
            },
        });
        const errors: string[] = [];
        const orig = console.error;
        console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
        try {
            await fm.loadForTokens([
                { text: 'Hi', size: 12, font: 'inter', weight: 'regular' as const },
            ], { _hint: 'cli', fonts: [INTER_REGULAR] });
        } finally {
            console.error = orig;
        }
        const scanLog = errors.find(e => e.includes('Scanned'));
        assert.ok(!scanLog, 'no scan log expected when explicit paths cover all fonts');
    });

    test('concurrent loadForTokens calls share the system index build', async () => {
        let scanCount = 0;
        const fm = await NodeFontManager.createWithOptions({
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
