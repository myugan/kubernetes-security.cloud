import { visit } from 'unist-util-visit';

/**
 * Shiki `wrap: true` emits a trailing empty `<span class="line">` when fenced code
 * ends with a final newline. Astro runs user `rehypePlugins` after `rehypeShiki`, so
 * we can drop those artifacts (and trailing whitespace text nodes) from the HAST.
 */
function classList(properties) {
  const raw = properties?.className;
  if (!raw) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

function isAstroCodePre(node) {
  if (node.type !== 'element' || node.tagName !== 'pre') return false;
  return classList(node.properties).some((c) => c.includes('astro-code'));
}

function isEmptyShikiLine(node) {
  if (node.type !== 'element' || node.tagName !== 'span') return false;
  if (!classList(node.properties).includes('line')) return false;
  const ch = node.children;
  if (!ch || ch.length === 0) return true;
  if (ch.length !== 1 || ch[0].type !== 'element' || ch[0].tagName !== 'span') return false;
  const inner = ch[0].children;
  return !inner || inner.length === 0;
}

export default function rehypeTrimTrailingShikiLines() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!isAstroCodePre(node)) return;
      const code = node.children?.find((c) => c.type === 'element' && c.tagName === 'code');
      if (!code?.children?.length) return;

      while (code.children.length > 0) {
        const last = code.children[code.children.length - 1];
        if (last.type === 'text' && /^\s*$/.test(String(last.value ?? ''))) {
          code.children.pop();
          continue;
        }
        if (isEmptyShikiLine(last)) {
          code.children.pop();
          continue;
        }
        break;
      }
    });
  };
}
