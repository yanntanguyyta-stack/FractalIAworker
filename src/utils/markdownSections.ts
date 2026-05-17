/**
 * Extracts top-level sections from a markdown string. Only headings at the
 * minimum heading depth found in the input are treated as section boundaries;
 * deeper headings remain part of their parent section's content, preserving
 * the original hierarchy. Returns an empty list if no markdown heading is found.
 *
 * Example:
 *   ## A
 *   text
 *   ### A.1
 *   ## B
 * ─→ [{ heading: 'A', content: 'text\n### A.1' }, { heading: 'B', content: '' }]
 */
export interface MarkdownSection {
  heading: string;
  content: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function extractHeadingSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');

  let minDepth = Infinity;
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m && m[1].length < minDepth) minDepth = m[1].length;
  }
  if (minDepth === Infinity) return [];

  const topPattern = new RegExp(`^#{${minDepth}}\\s+(.+)$`);
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;

  for (const line of lines) {
    const m = line.match(topPattern);
    if (m) {
      if (current) sections.push({ ...current, content: current.content.trim() });
      current = { heading: m[1].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push({ ...current, content: current.content.trim() });
  return sections;
}
