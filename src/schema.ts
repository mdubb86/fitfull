import { z } from 'zod';
import type { Token } from './types.js';

/**
 * Input token schema - what users provide via CLI/JSON
 * Font is a string like "Inter Bold" that gets parsed into family + weight
 */
export const InputTokenSchema = z.object({
    text: z.string(),
    size: z.number().positive(),
    font: z.string(),  // "Inter", "Inter Bold", "Arial Light Italic", etc.
    color: z.string().optional(),  // optional per-token fill color (validated at render time)
});

export type InputToken = z.infer<typeof InputTokenSchema>;

export const InputTokenArraySchema = z.array(InputTokenSchema);

/**
 * Parse a font string like "Inter Bold" into family and weight
 */
export function parseFontString(fontString: string): { family: string; weight: string; style: string } {
    const parts = fontString.trim().split(/\s+/);

    const weights = ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
    const styles = ['italic', 'oblique'];

    let family: string[] = [];
    let weight = 'regular';
    let style = 'normal';

    for (const part of parts) {
        const lower = part.toLowerCase();
        if (weights.includes(lower)) {
            weight = lower;
        } else if (styles.includes(lower)) {
            style = lower;
        } else {
            family.push(part);
        }
    }

    return {
        family: family.join(' ') || fontString,
        weight,
        style,
    };
}

/**
 * Map parsed weight string to internal weight type
 */
export function mapWeight(weight: string, style: string): 'regular' | 'bold' | 'italic' | 'bolditalic' {
    const isBold = ['bold', 'semibold', 'extrabold', 'black'].includes(weight);
    const isItalic = style === 'italic' || style === 'oblique';

    if (isBold && isItalic) return 'bolditalic';
    if (isBold) return 'bold';
    if (isItalic) return 'italic';
    return 'regular';
}

/**
 * Convert an InputToken to internal Token format
 * Requires a font family resolver function
 */
export function inputTokenToToken(
    input: InputToken,
    resolveFontFamily: (family: string) => string
): Token {
    const parsed = parseFontString(input.font);
    const fontKey = resolveFontFamily(parsed.family);
    const weight = mapWeight(parsed.weight, parsed.style);

    return {
        text: input.text,
        size: input.size,
        font: fontKey,
        weight,
        ...(input.color !== undefined ? { color: input.color } : {}),
    };
}

/**
 * Convert array of InputTokens to internal Tokens
 */
export function inputTokensToTokens(
    inputs: InputToken[],
    resolveFontFamily: (family: string) => string
): Token[] {
    return inputs.map(input => inputTokenToToken(input, resolveFontFamily));
}
