import { test, describe } from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/cli.test.js -> repo root is dist/.. = ..
const ROOT = join(__dirname, '..');
const CLI = join(ROOT, 'dist', 'cli.js');
const INTER_REGULAR = join(ROOT, 'fonts', 'Inter-Regular.ttf');

let counter = 0;
function tmp(suffix: string): string {
    counter++;
    return join(tmpdir(), `fitfull-cli-test-${process.pid}-${counter}-${suffix}`);
}

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
    try {
        const stdout = execFileSync('node', [CLI, ...args], {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
        }).toString();
        return { stdout, stderr: '', status: 0 };
    } catch (e: any) {
        return {
            stdout: (e.stdout ?? '').toString(),
            stderr: (e.stderr ?? '').toString(),
            status: e.status ?? 1,
        };
    }
}

describe('CLI happy paths', () => {
    test('text mode produces SVG output', () => {
        const out = tmp('text.svg');
        const result = runCli([
            '--text', 'Hello',
            '--font', INTER_REGULAR,
            '--size', '200x50',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out), 'output file should exist');
        assert.ok(readFileSync(out, 'utf-8').startsWith('<svg'), 'output is SVG');

        const json = JSON.parse(result.stdout);
        assert.strictEqual(json.lines.length, 1);
        assert.ok(json.width > 0);
        assert.ok(json.height > 0);
        assert.ok(typeof json.textWidth === 'number' && json.textWidth > 0,
            `CLI JSON output should include positive textWidth, got ${json.textWidth}`);
        assert.ok(typeof json.textHeight === 'number' && json.textHeight > 0,
            `CLI JSON output should include positive textHeight, got ${json.textHeight}`);

        unlinkSync(out);
    });

    test('html mode produces SVG output', () => {
        const htmlPath = tmp('input.html');
        writeFileSync(htmlPath, '<body style="font-family: inter; font-size: 12px">Hello World</body>');
        const out = tmp('html.svg');

        const result = runCli([
            '--html', htmlPath,
            '--font', INTER_REGULAR,
            '--size', '400x100',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out));
        assert.ok(readFileSync(out, 'utf-8').startsWith('<svg'));

        const json = JSON.parse(result.stdout);
        assert.ok(json.lines.length >= 1);

        unlinkSync(htmlPath);
        unlinkSync(out);
    });

    test('tokens mode produces SVG output', () => {
        const tokensPath = tmp('tokens.json');
        writeFileSync(tokensPath, JSON.stringify([
            { text: 'Hello', size: 12, font: 'Inter', weight: 'regular' },
            { text: ' ', size: 12, font: 'Inter', weight: 'regular' },
            { text: 'World', size: 12, font: 'Inter', weight: 'regular' },
        ]));
        const out = tmp('tokens.svg');

        const result = runCli([
            '--tokens', tokensPath,
            '--font', INTER_REGULAR,
            '--size', '400x100',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out));
        assert.ok(readFileSync(out, 'utf-8').startsWith('<svg'));

        unlinkSync(tokensPath);
        unlinkSync(out);
    });

    test('CLI: JSON tokens with shadow field emit shadow markup in SVG', () => {
        const tokensPath = tmp('tokens-shadow.json');
        writeFileSync(tokensPath, JSON.stringify([
            { text: 'Hi', size: 1, font: 'Inter Bold', shadow: { offsetX: 0.05, offsetY: 0.05, color: 'rgba(0,0,0,0.5)' } },
        ]));
        const out = tmp('tokens-shadow.svg');

        const result = runCli([
            '--tokens', tokensPath,
            '--font', join(ROOT, 'fonts', 'Inter-Bold.ttf'),
            '--size', '400x100',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out));
        const svg = readFileSync(out, 'utf-8');
        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.includes('rgba(0,0,0,0.5)'), 'expected shadow color in SVG output');

        unlinkSync(tokensPath);
        unlinkSync(out);
    });

    test('CLI: --shadow-* flags on text mode emit shadow markup', () => {
        const out = tmp('flag-shadow.svg');
        const result = runCli([
            '--text', 'Hi',
            '--font', join(ROOT, 'fonts', 'Inter-Bold.ttf'),
            '--size', '400x100',
            '--shadow-x', '0.06em',
            '--shadow-y', '-0.06',
            '--shadow-color', '#ff5500',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out));
        const svg = readFileSync(out, 'utf-8');
        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.includes('#ff5500'), 'expected --shadow-color in SVG output');

        unlinkSync(out);
    });

    test('CLI: bare --shadow-color activates shadow with default offsets', () => {
        const out = tmp('flag-shadow-defaults.svg');
        const result = runCli([
            '--text', 'Hi',
            '--font', join(ROOT, 'fonts', 'Inter-Bold.ttf'),
            '--size', '400x100',
            '--shadow-color', 'blue',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        const svg = readFileSync(out, 'utf-8');
        assert.ok(svg.includes('blue'), 'expected shadow color in SVG output even without --shadow-x/-y');

        unlinkSync(out);
    });

    test('CLI: no --shadow-* flags → no shadow markup', () => {
        const out = tmp('flag-no-shadow.svg');
        const result = runCli([
            '--text', 'Hi',
            '--font', join(ROOT, 'fonts', 'Inter-Bold.ttf'),
            '--size', '400x100',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        const svg = readFileSync(out, 'utf-8');
        // Default text color is black; assert exactly one <path> per token
        // (no shadow-color paths doubling them).
        const pathCount = (svg.match(/<path /g) ?? []).length;
        assert.strictEqual(pathCount, 1, `expected 1 path (no shadow), got ${pathCount}`);

        unlinkSync(out);
    });

    test('CLI: --shadow-fade-threshold widens padding when tightened', () => {
        function outputDims(args: string[]): { w: number; h: number } {
            const result = runCli(args);
            assert.strictEqual(result.status, 0, `expected exit 0\n${result.stderr}`);
            const json = JSON.parse(result.stdout);
            return { w: json.width, h: json.height };
        }
        const outDefault = tmp('fade-default.png');
        const outTight   = tmp('fade-tight.png');
        // Use --text-height so the raw glyph is fixed and padding differences
        // show up directly in the output dimensions (auto-fit would clamp to
        // box height for both).
        const base = [
            '--text', 'A',
            '--font', join(ROOT, 'fonts', 'Inter-Bold.ttf'),
            '--size', '1000x1000',
            '--text-height', '100',
            '--shadow-x', '0', '--shadow-y', '0',
            '--shadow-blur', '0.08', '--shadow-color', '#ffffff',
        ];
        const defaultDims = outputDims([...base, '-o', outDefault]);
        const tightDims   = outputDims([...base, '--shadow-fade-threshold', '0.01', '-o', outTight]);
        assert.ok(tightDims.w > defaultDims.w, `tight threshold should widen output: default=${defaultDims.w} tight=${tightDims.w}`);
        assert.ok(tightDims.h > defaultDims.h, `tight threshold should raise output: default=${defaultDims.h} tight=${tightDims.h}`);
        unlinkSync(outDefault);
        unlinkSync(outTight);
    });

    test('CLI: --shadow-fade-threshold rejects out-of-range values', () => {
        const font = join(ROOT, 'fonts', 'Inter-Bold.ttf');
        const bad = ['0', '-0.1', '1.5', 'abc'];
        for (const val of bad) {
            const result = runCli([
                '--text', 'A', '--font', font, '--size', '400x100',
                '--shadow-x', '0.05',
                '--shadow-fade-threshold', val,
                '-o', tmp('bad.png'),
            ]);
            assert.notStrictEqual(result.status, 0, `expected non-zero exit for --shadow-fade-threshold ${val}`);
            assert.ok(result.stderr.includes('shadow-fade-threshold'), `expected error to mention flag; got: ${result.stderr}`);
        }
    });
});

describe('CLI stdin and output dispatch', () => {
    test('html mode reads from stdin with -', async () => {
        const out = tmp('stdin.svg');
        const html = '<body style="font-family: inter; font-size: 12px">From stdin</body>';

        await new Promise<void>((resolve, reject) => {
            const proc = spawn('node', [CLI,
                '--html', '-',
                '--font', INTER_REGULAR,
                '--size', '400x100',
                '-o', out,
            ], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });

            let stderr = '';
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`exit ${code}\n${stderr}`));
            });
            proc.stdin.write(html);
            proc.stdin.end();
        });

        assert.ok(existsSync(out));
        assert.ok(readFileSync(out, 'utf-8').startsWith('<svg'));
        unlinkSync(out);
    });

    test('PNG output is generated when -o ends with .png', () => {
        const out = tmp('out.png');
        const result = runCli([
            '--text', 'Hello',
            '--font', INTER_REGULAR,
            '--size', '200x50',
            '-o', out,
        ]);

        assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
        assert.ok(existsSync(out));

        const buf = readFileSync(out);
        // PNG magic bytes: 89 50 4E 47
        assert.strictEqual(buf[0], 0x89);
        assert.strictEqual(buf[1], 0x50);
        assert.strictEqual(buf[2], 0x4E);
        assert.strictEqual(buf[3], 0x47);

        unlinkSync(out);
    });
});

describe('CLI error paths', () => {
    test('exits with error when no input mode provided', () => {
        const result = runCli([
            '--size', '200x50',
            '--font', INTER_REGULAR,
            '-o', tmp('nope.svg'),
        ]);

        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /Provide --text, --tokens, or --html/);
    });

    test('exits with error on conflicting input modes', () => {
        const htmlPath = tmp('conflict.html');
        writeFileSync(htmlPath, '<body></body>');

        const result = runCli([
            '--text', 'Hi',
            '--html', htmlPath,
            '--font', INTER_REGULAR,
            '--size', '400x100',
            '-o', tmp('conflict.svg'),
        ]);

        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /Provide only one of/);
        unlinkSync(htmlPath);
    });

    test('exits with error on conflicting size options', () => {
        const result = runCli([
            '--text', 'Hi',
            '--font', INTER_REGULAR,
            '--size', '400x100',
            '--text-height', '20',
            '--max-text-height', '30',
            '-o', tmp('conflict.svg'),
        ]);

        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /Cannot use both/);
    });

    test('exits with error on zero-dimension size', () => {
        const result = runCli([
            '--text', 'Hi',
            '--font', INTER_REGULAR,
            '--size', '0x100',
            '-o', tmp('zero.svg'),
        ]);

        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /must be positive integers/);
    });

    test('exits with error on invalid color (XSS attempt)', () => {
        const result = runCli([
            '--text', 'Hello',
            '--font', INTER_REGULAR,
            '--size', '200x50',
            '--color', 'red"/><script>',
            '-o', tmp('xss.svg'),
        ]);

        assert.notStrictEqual(result.status, 0);
        assert.match(result.stderr, /Invalid color/);
    });
});
