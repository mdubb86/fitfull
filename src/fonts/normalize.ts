/** Normalize a CSS font-family string to a lowercase hyphenated key. */
export function normalizeFamily(name: string): string {
    const first = name.split(',')[0].trim();
    const unquoted = first.replace(/^['"]|['"]$/g, '');
    return unquoted.toLowerCase().replace(/\s+/g, '-');
}
