import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname is dist/test-utils at runtime; snapshots live in src/__snapshots__
// so we go up two levels (out of dist/) then into src/__snapshots__
const SNAP_DIR = join(__dirname, '..', '..', 'src', '__snapshots__');

/**
 * Assert that a string matches a stored snapshot file.
 * On first run (or with UPDATE_SNAPSHOTS=1), writes the snapshot.
 * Otherwise compares character-for-character; throws on mismatch.
 */
export function assertSnapshot(name: string, actual: string): void {
    const path = join(SNAP_DIR, `${name}.svg`);
    const shouldUpdate = process.env.UPDATE_SNAPSHOTS === '1';

    if (shouldUpdate || !existsSync(path)) {
        mkdirSync(SNAP_DIR, { recursive: true });
        writeFileSync(path, actual);
        return;
    }

    const expected = readFileSync(path, 'utf-8');
    if (actual !== expected) {
        throw new Error(
            `Snapshot mismatch for "${name}".\n\n` +
            `--- expected (${path})\n${expected}\n` +
            `--- actual\n${actual}\n` +
            `\nRun "pnpm test:update" to accept changes.`
        );
    }
}
