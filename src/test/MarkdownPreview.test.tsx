import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownPreview from '../components/MarkdownPreview';

describe('MarkdownPreview - XSS sanitization', () => {
  it('should strip raw <script> tags from markdown content', () => {
    const malicious = 'Hello\n\n<script>window.__xss = true;</script>\n\nWorld';
    const { container } = render(<MarkdownPreview content={malicious} />);
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it('should strip onerror handlers from inline HTML images', () => {
    const malicious = '<img src="x" onerror="window.__xss2 = true" />';
    const { container } = render(<MarkdownPreview content={malicious} />);
    const img = container.querySelector('img');
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull();
    }
    expect((window as unknown as { __xss2?: boolean }).__xss2).toBeUndefined();
  });

  it('should block javascript: URLs in markdown links', () => {
    const malicious = '[click me](javascript:alert(1))';
    const { container } = render(<MarkdownPreview content={malicious} />);
    const link = container.querySelector('a');
    if (link) {
      const href = link.getAttribute('href') || '';
      expect(href.toLowerCase()).not.toMatch(/^javascript:/);
    }
  });

  it('should strip <iframe> tags', () => {
    const malicious = '<iframe src="https://evil.example"></iframe>';
    const { container } = render(<MarkdownPreview content={malicious} />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('should strip event handlers from arbitrary elements', () => {
    const malicious = '<div onclick="alert(1)" onmouseover="alert(2)">hover</div>';
    const { container } = render(<MarkdownPreview content={malicious} />);
    const divs = container.querySelectorAll('div');
    divs.forEach((d) => {
      expect(d.getAttribute('onclick')).toBeNull();
      expect(d.getAttribute('onmouseover')).toBeNull();
    });
  });

  it('should strip <style> tags', () => {
    const malicious = '<style>body { display: none; }</style>\n\nText';
    const { container } = render(<MarkdownPreview content={malicious} />);
    expect(container.querySelector('style')).toBeNull();
  });

  it('should strip <object> and <embed>', () => {
    const malicious = '<object data="evil.swf"></object><embed src="evil.swf">';
    const { container } = render(<MarkdownPreview content={malicious} />);
    expect(container.querySelector('object')).toBeNull();
    expect(container.querySelector('embed')).toBeNull();
  });
});

describe('MarkdownPreview - rendering', () => {
  it('should render standard markdown (headings, bold, links)', () => {
    const content = '# Title\n\n**bold** and [a link](https://example.com)';
    const { container, getByText } = render(<MarkdownPreview content={content} />);
    expect(container.querySelector('h1')).not.toBeNull();
    expect(getByText('Title')).toBeDefined();
    expect(getByText('bold').tagName).toBe('STRONG');
    const link = container.querySelector('a[href="https://example.com"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('should render mermaid code blocks as <div class="mermaid"> for later processing', () => {
    const content = '```mermaid\ngraph TD\n  A --> B\n```';
    const { container } = render(<MarkdownPreview content={content} />);
    const mermaidDiv = container.querySelector('div.mermaid');
    expect(mermaidDiv).not.toBeNull();
    expect(mermaidDiv?.textContent).toContain('graph TD');
  });

  it('should render GFM tables', () => {
    const content = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { container } = render(<MarkdownPreview content={content} />);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th').length).toBe(2);
    expect(container.querySelectorAll('td').length).toBe(2);
  });

  it('should generate a references table for embedded URLs', () => {
    const content = 'Voir https://example.com et [docs](https://docs.example.com)';
    const { container, getByText } = render(<MarkdownPreview content={content} />);
    expect(getByText('🔗 Références')).toBeDefined();
    const refTable = container.querySelectorAll('table');
    expect(refTable.length).toBeGreaterThan(0);
  });

  it('should not generate a references section when no URLs are present', () => {
    const content = '# Plain\n\nNo links here.';
    const { queryByText } = render(<MarkdownPreview content={content} />);
    expect(queryByText('🔗 Références')).toBeNull();
  });

  it('should render code blocks with appropriate styling', () => {
    const content = '```js\nconst x = 1;\n```';
    const { container } = render(<MarkdownPreview content={content} />);
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelector('code')).not.toBeNull();
  });
});
