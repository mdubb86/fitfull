import { readFileSync } from 'node:fs';
import { initWasm } from '@resvg/resvg-wasm';
// @ts-expect-error — Bun-specific import attribute, not understood by tsc/Node
import wasmPath from '@resvg/resvg-wasm/index_bg.wasm' with { type: 'file' };
import { program } from './cli-program.js';

await initWasm(readFileSync(wasmPath));
program.parse();
