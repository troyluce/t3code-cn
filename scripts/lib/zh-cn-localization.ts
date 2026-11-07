import MagicString from "magic-string";
import ts from "typescript-legacy";
import type { Plugin } from "vite-plus";
import translations from "../../localization/zh-CN.json" with { type: "json" };

const displayProperties =
  /^(?:aria-label|aria-description|title|label|description|placeholder|alt|message|detail|heading|summary|hint|helpText|tooltip|emptyText|emptyMessage|errorMessage|successMessage|buttonLabel|confirmLabel|cancelLabel|text|caption|shortLabel|searchPlaceholder|loadingText|fallbackLabel)$/;
const dictionary: Readonly<Record<string, string>> = translations;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

function isDisplayValue(node: ts.Node): boolean {
  let child = node;
  let parent = node.parent;
  while (
    parent &&
    ((ts.isConditionalExpression(parent) &&
      (parent.whenTrue === child || parent.whenFalse === child)) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isJsxExpression(parent) ||
      (ts.isBinaryExpression(parent) &&
        [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
          parent.operatorToken.kind,
        )))
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (!parent) return false;
  if (ts.isTemplateSpan(parent)) return isDisplayValue(parent.parent);
  if (ts.isArrayLiteralExpression(parent)) {
    const owner = ts.isAsExpression(parent.parent) ? parent.parent.parent : parent.parent;
    return ts.isVariableDeclaration(owner) && owner.name.getText() === "ONBOARDING_STAGES";
  }
  if (ts.isJsxAttribute(parent)) return displayProperties.test(parent.name.getText());
  if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) return true;
  const displayVariable =
    /(?:labels?|titles?|descriptions?|tooltips?|hints?|placeholders?|messages?|summar(?:y|ies)|headings?|_TEXT)$/i;
  if (ts.isVariableDeclaration(parent) && parent.initializer === child)
    return displayVariable.test(parent.name.getText());
  if (ts.isPropertyAssignment(parent) && parent.initializer === child) {
    const name = parent.name.getText().replace(/^['"]|['"]$/g, "");
    if (displayProperties.test(name)) return true;
    if (
      /^(?:value|id|type|key|code|command|method|model|provider|route|path|url|href|className|color)$/.test(
        name,
      )
    )
      return false;
    for (let owner: ts.Node | undefined = parent.parent; owner; owner = owner.parent) {
      if (ts.isVariableDeclaration(owner)) return displayVariable.test(owner.name.getText());
      if (ts.isFunctionLike(owner)) return false;
    }
  }
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression.getText();
    return (
      /^(?:(?:window|globalThis)\.)?(?:alert|confirm)$/.test(callee) ||
      /^(?:toast(?:Manager)?|toaster)\.(?:error|success|info|warning|message|add)$/.test(callee) ||
      /^(?:setError|setErrorMessage|setMessage|setTitle|setDescription|showError)$/.test(callee)
    );
  }
  if (ts.isReturnStatement(parent)) {
    for (let scope: ts.Node | undefined = parent.parent; scope; scope = scope.parent) {
      if (!ts.isFunctionLike(scope)) continue;
      if (scope.type && scope.type.kind !== ts.SyntaxKind.StringKeyword) return false;
      const name =
        scope.name?.getText() ??
        (ts.isVariableDeclaration(scope.parent) ? scope.parent.name.getText() : "");
      return /label|title|description|tooltip|display|summary|reason|message|hint|placeholder/i.test(
        name,
      );
    }
  }
  return false;
}

function isPluralSuffix(node: ts.Node): boolean {
  return (
    ts.isConditionalExpression(node) &&
    ts.isStringLiteral(node.whenTrue) &&
    ts.isStringLiteral(node.whenFalse) &&
    [node.whenTrue.text, node.whenFalse.text].every((value) => ["", "s", "es"].includes(value)) &&
    (node.whenTrue.text === "" || node.whenFalse.text === "")
  );
}

function translate(text: string, catalog: Readonly<Record<string, string>>) {
  const key = normalize(text);
  if (/^[a-z\d]+(?:[./:_-][a-z\d]+)+$/.test(key) || /^(?:https?:|[~/\\]|--)/.test(key))
    return undefined;
  if (
    /^(?:npx|npm|pnpm|bunx?|yarn|node|python\d*|pip\d*|uv|cargo|git|gh|codex|claude|opencode|ssh|tailscale|curl|wget|powershell|pwsh|bash|zsh)\s/.test(
      key,
    )
  )
    return undefined;
  const result = catalog[key];
  if (result === undefined || result === key) return undefined;
  const placeholders = (value: string) => [...value.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
  if (JSON.stringify(placeholders(key)) !== JSON.stringify(placeholders(result))) {
    throw new Error(`Invalid translation placeholders: ${key}`);
  }
  return result;
}

export function localizeChineseCode(
  code: string,
  id: string,
  catalog: Readonly<Record<string, string>> = dictionary,
) {
  const source = ts.createSourceFile(
    id,
    code,
    ts.ScriptTarget.Latest,
    true,
    id.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let edits: Array<{ start: number; end: number; text: string }> = [];
  const renderRange = (start: number, end: number) => {
    let value = code.slice(start, end);
    for (const edit of edits
      .filter((e) => e.start >= start && e.end <= end)
      .sort((a, b) => b.start - a.start)) {
      value = value.slice(0, edit.start - start) + edit.text + value.slice(edit.end - start);
    }
    return value;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const brand =
        ts.isJsxElement(node) &&
        node.children.some(
          (child) =>
            ts.isJsxSelfClosingElement(child) && child.tagName.getText(source) === "T3Wordmark",
        );
      const verbatim =
        brand ||
        /^(?:code|pre|kbd|samp|CodeBlock|CodeSnippet|InlineCode|CommandBlock)$/.test(
          opening.tagName.getText(source),
        ) ||
        opening.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === "translate" &&
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === "no",
        );
      if (verbatim) return;
    }
    ts.forEachChild(node, visit);
    const start = ts.isJsxText(node) ? node.pos : node.getStart(source);
    let text: string | undefined;
    if (ts.isJsxText(node)) {
      const raw = code.slice(start, node.end);
      const translated = translate(raw, catalog);
      if (translated !== undefined) {
        const escaped = translated
          .replace(/&(?!#\d+;|#x[\da-f]+;|[a-z]+;)/gi, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\{/g, "&#123;")
          .replace(/\}/g, "&#125;");
        text = (raw.match(/^\s*/)?.[0] ?? "") + escaped + (raw.match(/\s*$/)?.[0] ?? "");
      }
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isDisplayValue(node)
    ) {
      let translated = translate(node.text, catalog);
      if (ts.isCallExpression(node.parent) && /^[a-z][a-z\d]*$/.test(node.text))
        translated = undefined;
      if (ts.isConditionalExpression(node.parent) && isPluralSuffix(node.parent)) translated = "";
      if (translated !== undefined) {
        text = ts.isJsxAttribute(node.parent)
          ? `{${JSON.stringify(translated)}}`
          : JSON.stringify(translated);
      }
    } else if (ts.isTemplateExpression(node) && isDisplayValue(node)) {
      const key =
        node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join("");
      let translated = translate(key, catalog);
      if (translated !== undefined) {
        const expressions = node.templateSpans.map((span) =>
          renderRange(span.expression.getStart(source), span.expression.end),
        );
        node.templateSpans.forEach((span, i) => {
          if (isPluralSuffix(span.expression)) translated = translated?.replaceAll(`{${i}}`, "");
        });
        const order = [...translated.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1]));
        const reordered = order.some(
          (index, position) => index !== [...order].sort((a, b) => a - b)[position],
        );
        const literal = (value: string) =>
          value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
        let cursor = 0;
        let body = "`";
        for (const match of translated.matchAll(/\{(\d+)\}/g)) {
          body += literal(translated.slice(cursor, match.index));
          const index = Number(match[1]);
          body += "${" + (reordered ? `__zh${index}` : expressions[index]) + "}";
          cursor = match.index + match[0].length;
        }
        body += literal(translated.slice(cursor)) + "`";
        // Capture interpolation values in source order before a translation reorders them.
        text = reordered
          ? `((${expressions.map((_, i) => `__zh${i}`).join(", ")}) => ${body})(${expressions.map((value) => "`${" + value + "}`").join(", ")})`
          : body;
      }
    }
    if (text !== undefined) {
      edits = edits.filter((edit) => edit.start < start || edit.end > node.end);
      edits.push({ start, end: node.end, text });
    }
  };
  visit(source);
  if (edits.length === 0) return null;
  const output = new MagicString(code);
  for (const edit of edits) output.overwrite(edit.start, edit.end, edit.text);
  return {
    code: output.toString(),
    map: output.generateMap({ hires: true, source: id, includeContent: true }),
  };
}

export function chineseLocalizationPlugin(): Plugin | undefined {
  if (process.env.T3CODE_ZH_CN !== "1") return undefined;
  return {
    name: "t3code-zh-cn",
    enforce: "pre",
    apply: (_config, env) => env.mode !== "test",
    transform(code, id) {
      const filename = id.split("?")[0]!.replaceAll("\\", "/");
      if (
        !/\/apps\/(?:web|desktop)\/src\/.*\.(?:ts|tsx)$/.test(filename) ||
        /\.(?:test|gen)\./.test(filename)
      )
        return null;
      return localizeChineseCode(code, filename);
    },
  };
}
