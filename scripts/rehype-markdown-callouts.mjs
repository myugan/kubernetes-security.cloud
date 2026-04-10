import { visit } from 'unist-util-visit';

/** @param {import('hast').Element} el */
function textContent(el) {
  if (!el.children?.length) return '';
  return el.children
    .map((child) => {
      if (child.type === 'text') return child.value;
      if (child.type === 'element') return textContent(child);
      return '';
    })
    .join('');
}

/* Allow optional spaces: `[! NOTE ]` matches GitHub-style `> [!NOTE]` */
const OPENER_RE = /^\[!\s*(NOTE|INFO|TIP|WARNING|DANGER|CAUTION|IMPORTANT)\s*\]\s*/i;

const LABELS = {
  info: 'Info',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
};

function normalizeKind(raw) {
  const k = raw.toLowerCase();
  if (k === 'note' || k === 'info' || k === 'important') return 'info';
  if (k === 'tip') return 'tip';
  if (k === 'warning') return 'warning';
  if (k === 'danger' || k === 'caution') return 'danger';
  return 'info';
}

function labelFor(kind) {
  return LABELS[kind] ?? 'Note';
}

/** Strip `count` UTF-16 code units from the start of sequential leading text nodes. */
function stripLeadingTextChars(paragraph, count) {
  if (count <= 0) return;
  let left = count;
  const out = [];
  for (const child of paragraph.children ?? []) {
    if (left <= 0) {
      out.push(child);
      continue;
    }
    if (child.type === 'text') {
      const v = child.value;
      if (v.length <= left) {
        left -= v.length;
      } else {
        out.push({ ...child, value: v.slice(left) });
        left = 0;
      }
    } else {
      out.push(child);
    }
  }
  paragraph.children = out;
}

function isWhitespaceText(node) {
  return node.type === 'text' && /^\s*$/.test(node.value ?? '');
}

function paragraphIsMeaningful(p) {
  return textContent(p).trim().length > 0;
}

/**
 * GitHub-style markdown callouts in blockquotes:
 *
 * > [!NOTE]
 * > Body (same or next paragraph)
 *
 * Supported tags: NOTE, INFO, IMPORTANT, TIP, WARNING, DANGER, CAUTION
 *
 * Note: Blockquotes from remark often start with a newline text node before the first <p>.
 */
export default function rehypeMarkdownCallouts() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'blockquote') return;

      const kids = node.children ?? [];
      const first = kids.find((c) => c.type === 'element' && c.tagName === 'p');
      if (!first) return;

      const raw = textContent(first);
      const opener = raw.match(OPENER_RE);
      if (!opener || opener.index !== 0) return;

      const kind = normalizeKind(opener[1]);
      const prefixLen = opener[0].length;

      const labelEl = {
        type: 'element',
        tagName: 'p',
        properties: { className: ['callout-label'] },
        children: [
          {
            type: 'element',
            tagName: 'strong',
            properties: {},
            children: [{ type: 'text', value: labelFor(kind) }],
          },
        ],
      };

      const firstIndex = kids.indexOf(first);
      const tail = kids
        .slice(firstIndex + 1)
        .filter((c) => !isWhitespaceText(c));

      stripLeadingTextChars(first, prefixLen);

      const nextChildren = [labelEl];
      if (paragraphIsMeaningful(first)) {
        nextChildren.push(first);
      }
      nextChildren.push(...tail);

      node.properties = node.properties ?? {};
      node.properties.className = ['callout', `callout-${kind}`];
      node.children = nextChildren;
    });
  };
}
