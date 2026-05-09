import type { Token, TokenMetrics } from '../types.js';
import { getLineMetrics } from '../measure/index.js';

/** Trim leading whitespace from first token, trailing from last */

export function trimLineWhitespace(tokens: Token[]): Token[] {
    if (tokens.length === 0) return tokens;

    const result = [...tokens];

    // Trim leading whitespace from first token
    if (result.length > 0) {
        const first = result[0];
        const trimmedText = first.text.trimStart();
        if (trimmedText !== first.text) {
            if (trimmedText === '') {
                result.shift();
            } else {
                result[0] = { ...first, text: trimmedText };
            }
        }
    }

    // Trim trailing whitespace from last token
    if (result.length > 0) {
        const lastIdx = result.length - 1;
        const last = result[lastIdx];
        const trimmedText = last.text.trimEnd();
        if (trimmedText !== last.text) {
            if (trimmedText === '') {
                result.pop();
            } else {
                result[lastIdx] = { ...last, text: trimmedText };
            }
        }
    }

    return result;
}

/** Build greedy arrangement: fill lines to target width before wrapping */
export function buildGreedyArrangement(
    tokens: Token[],
    tokenMetricsMap: Map<Token, TokenMetrics>,
    maxLines: number,
    targetWidth: number  // in scale=1 units
): Token[][] {
    const lines: Token[][] = [];
    let currentLine: Token[] = [];
    let currentMetrics: TokenMetrics[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const metrics = tokenMetricsMap.get(token)!;

        // Try adding token to current line
        const testMetrics = [...currentMetrics, metrics];
        const lineMetrics = getLineMetrics(testMetrics);

        // Check if adding this token exceeds target width
        // AND we have room for more lines AND current line has content
        const exceedsWidth = lineMetrics.width > targetWidth;
        const hasRoomForMoreLines = lines.length < maxLines - 1;
        const currentLineHasContent = currentLine.length > 0;

        if (exceedsWidth && hasRoomForMoreLines && currentLineHasContent) {
            // Wrap: finish current line, start new one
            lines.push(trimLineWhitespace(currentLine));
            currentLine = [token];
            currentMetrics = [metrics];
        } else {
            // Add to current line
            currentLine.push(token);
            currentMetrics.push(metrics);
        }
    }

    // Add final line
    if (currentLine.length > 0) {
        lines.push(trimLineWhitespace(currentLine));
    }

    return lines;
}

/** Generate arrangements by breaking near ideal cumulative width positions */
export function *generateSmartArrangements(
    tokens: Token[],
    cumulativeWidths: number[],
    totalWidth: number,
    minLines: number,
    maxLines: number
): Generator<Token[][]> {
    const effectiveMaxLines = Math.min(maxLines, tokens.length);
    const MAX_ARRANGEMENTS_PER_LINE_COUNT = 100_000;

    for (let numLines = minLines; numLines <= effectiveMaxLines; numLines++) {
        if (numLines === 1) {
            yield [tokens];
            continue;
        }

        // Adaptive window: keep total combinations under budget
        // (2W+1)^(numLines-1) <= MAX_ARRANGEMENTS_PER_LINE_COUNT
        const numBreaks = numLines - 1;
        const W = Math.max(1, Math.floor(
            (Math.pow(MAX_ARRANGEMENTS_PER_LINE_COUNT, 1 / numBreaks) - 1) / 2
        ));

        // Compute ideal break indices based on even width distribution
        const idealBreaks: number[] = [];
        for (let k = 1; k < numLines; k++) {
            const targetWidth = totalWidth * k / numLines;
            // Find closest token index to target cumulative width
            let best = 0;
            for (let i = 0; i < cumulativeWidths.length; i++) {
                if (Math.abs(cumulativeWidths[i] - targetWidth) < Math.abs(cumulativeWidths[best] - targetWidth)) {
                    best = i;
                }
            }
            // Break is AFTER token `best`, so break index = best + 1
            idealBreaks.push(best + 1);
        }

        // Build windows: for each break, the range of valid indices
        const windows: Array<{ lo: number; hi: number }> = [];
        for (let k = 0; k < idealBreaks.length; k++) {
            const ideal = idealBreaks[k];
            const lo = Math.max(1, ideal - W); // at least 1 token on first line
            const hi = Math.min(tokens.length - (numLines - k - 1), ideal + W); // leave room for remaining lines
            windows.push({ lo, hi });
        }

        // Generate all combinations of break points within windows
        yield* generateWindowCombinations(tokens, windows, 0, []);
    }
}

/** Recursively generate break point combinations within windows */
function *generateWindowCombinations(
    tokens: Token[],
    windows: Array<{ lo: number; hi: number }>,
    depth: number,
    breaks: number[]
): Generator<Token[][]> {
    if (depth === windows.length) {
        // All breaks chosen — produce the arrangement
        const lines: Token[][] = [];
        let start = 0;
        for (const brk of breaks) {
            lines.push(tokens.slice(start, brk));
            start = brk;
        }
        lines.push(tokens.slice(start)); // last line
        yield lines;
        return;
    }

    const { lo, hi } = windows[depth];
    const prevBreak = depth > 0 ? breaks[depth - 1] : 0;

    for (let i = Math.max(lo, prevBreak + 1); i <= hi; i++) {
        breaks.push(i);
        yield* generateWindowCombinations(tokens, windows, depth + 1, breaks);
        breaks.pop();
    }
}
