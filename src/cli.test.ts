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
