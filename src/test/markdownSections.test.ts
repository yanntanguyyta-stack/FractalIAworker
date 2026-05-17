import { describe, it, expect } from 'vitest';
import { extractHeadingSections } from '../utils/markdownSections';

describe('extractHeadingSections', () => {
  it('returns empty list when no heading is present', () => {
    expect(extractHeadingSections('just some text\nno headings here')).toEqual([]);
  });

  it('returns empty list for empty input', () => {
    expect(extractHeadingSections('')).toEqual([]);
  });

  it('extracts a single H2 section with its content', () => {
    const md = `## Section A
some content here
more content`;
    expect(extractHeadingSections(md)).toEqual([
      { heading: 'Section A', content: 'some content here\nmore content' },
    ]);
  });

  it('extracts multiple sibling sections at the same depth', () => {
    const md = `## A
content A
## B
content B`;
    expect(extractHeadingSections(md)).toEqual([
      { heading: 'A', content: 'content A' },
      { heading: 'B', content: 'content B' },
    ]);
  });

  it('uses the minimum heading depth as the section boundary', () => {
    // ## is the min depth, so ### stays inside section content
    const md = `## A
intro
### A.1
detail
## B
something`;
    const result = extractHeadingSections(md);
    expect(result).toEqual([
      { heading: 'A', content: 'intro\n### A.1\ndetail' },
      { heading: 'B', content: 'something' },
    ]);
  });

  it('does not flatten nested headings into siblings', () => {
    // Earlier (buggy) behavior produced 4 siblings; correct: 1 top section with nested content
    const md = `## Top
### Nested 1
### Nested 2
### Nested 3`;
    const result = extractHeadingSections(md);
    expect(result).toHaveLength(1);
    expect(result[0].heading).toBe('Top');
    expect(result[0].content).toContain('### Nested 1');
    expect(result[0].content).toContain('### Nested 3');
  });

  it('trims content of each section', () => {
    const md = `## A



content
   `;
    const [section] = extractHeadingSections(md);
    expect(section.content).toBe('content');
  });

  it('supports headings from H1 to H6 as min depth', () => {
    const md = `# Project
## ignored as sub-heading
content`;
    expect(extractHeadingSections(md)).toEqual([
      { heading: 'Project', content: '## ignored as sub-heading\ncontent' },
    ]);
  });

  it('handles section with empty body', () => {
    const md = `## A
## B
text`;
    expect(extractHeadingSections(md)).toEqual([
      { heading: 'A', content: '' },
      { heading: 'B', content: 'text' },
    ]);
  });

  it('ignores lines that look like headings but are not valid (no space after #)', () => {
    const md = `##NotAHeading
just text`;
    expect(extractHeadingSections(md)).toEqual([]);
  });
});
