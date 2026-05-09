import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
const version = pkg.version;
const tag = `v${version}`;

const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) {
    console.error(`Error: Working tree is dirty. Commit or stash changes before releasing.\n${dirty}`);
    process.exit(1);
}

const existing = execSync(`git tag -l ${tag}`).toString().trim();
if (existing) {
    console.error(`Error: Tag ${tag} already exists. Bump version in package.json first.`);
    process.exit(1);
}

console.log(`Tagging ${tag}...`);
execSync(`git tag ${tag}`);
execSync(`git push origin ${tag}`);
console.log(`\nDone! Monitor the release at:`);
console.log(`https://github.com/mdubb86/fitfull/releases/tag/${tag}`);
