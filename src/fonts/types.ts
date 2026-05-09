/** Font weights for a single family */
export type FontWeights = {
    regular?: string;       // path or system font name
    bold?: string;
    italic?: string;
    bolditalic?: string;
};

/** Multi-family font configuration */
export type FontConfig = {
    [family: string]: FontWeights;
};
