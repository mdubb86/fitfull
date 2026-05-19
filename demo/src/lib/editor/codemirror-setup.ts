import { type Extension } from '@codemirror/state';
import { keymap, lineNumbers, highlightActiveLine, drawSelection, hoverTooltip } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { linter, lintKeymap } from '@codemirror/lint';
import { searchKeymap } from '@codemirror/search';
import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import { jsonSchemaLinter, jsonSchemaHover, jsonCompletion, stateExtensions, handleRefresh } from 'codemirror-json-schema';
import tokensSchema from '$lib/tokens/schema.json';

/**
 * Returns the CodeMirror 6 extension array for the Tokens editor.
 * - JSON syntax, bracket matching, auto-completion, history.
 * - Two linters: the basic JSON syntax linter + a schema-aware linter from
 *   codemirror-json-schema (typed against demo/src/lib/tokens/schema.json).
 * - JSON-schema-driven hover (wrapped in hoverTooltip) and completion (registered
 *   on jsonLanguage.data) — same wiring as the package's own jsonSchema() bundle.
 * - No `basicSetup` import — we cherry-pick exactly what we need.
 */
export function tokensEditorExtensions(): Extension[] {
    return [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...lintKeymap,
            indentWithTab,
        ]),
        json(),
        linter(jsonParseLinter()),
        linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
        jsonLanguage.data.of({ autocomplete: jsonCompletion() }),
        hoverTooltip(jsonSchemaHover()),
        stateExtensions(tokensSchema as any),
    ];
}
