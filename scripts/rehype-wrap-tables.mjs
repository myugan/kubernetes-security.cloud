import { visit } from 'unist-util-visit';

/**
 * Wraps markdown <table> nodes in a div for overflow, border radius, and spacing.
 */
export default function rehypeWrapTables() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table') return;
      if (!parent || typeof index !== 'number') return;

      const parentClasses = parent.properties?.className;
      const classList = Array.isArray(parentClasses)
        ? parentClasses
        : parentClasses
          ? [parentClasses]
          : [];
      if (parent.tagName === 'div' && classList.includes('prose-table-wrap')) return;

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['prose-table-wrap'],
        },
        children: [node],
      };
      parent.children[index] = wrapper;
    });
  };
}
