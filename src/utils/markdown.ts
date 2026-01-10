/**
 * Simple markdown to HTML conversion utilities
 * For basic markdown rendering without external dependencies
 */

/**
 * Convert simple markdown to HTML
 * Supports: links, lists, bold, italic, inline code
 */
export function renderSimpleMarkdown(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Convert markdown links [text](url) to HTML
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-primary-700 hover:underline">$1</a>'
    )
    // Convert bold **text** to HTML
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert italic *text* to HTML (but not if it's part of bold)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Convert inline code `code` to HTML
    .replace(
      /`([^`]+)`/g,
      '<code class="text-sm bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded">$1</code>'
    );

  // Convert list items
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul class="list-disc pl-5 space-y-1">');
        inList = true;
      }
      processedLines.push(`<li>${trimmedLine.slice(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (trimmedLine) {
        processedLines.push(`<p>${trimmedLine}</p>`);
      }
    }
  }

  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('\n');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Strip markdown formatting and return plain text
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/^[-*]\s+/gm, '') // Remove list markers
    .trim();
}
