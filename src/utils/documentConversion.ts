import { extractRawText } from 'mammoth/mammoth.browser';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

const fileExtensionRegex = /\.([^.]+)$/;

function getFileExtension(filename: string): string {
  const match = filename.toLowerCase().match(fileExtensionRegex);
  return match ? match[1] : '';
}

function toTitleFromFilename(filename: string): string {
  const name = filename.replace(fileExtensionRegex, '').trim();
  return name || 'Document importé';
}

function wrapTextAsMarkdown(text: string, title: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `# ${title}\n\n`;
  }
  return `# ${title}\n\n${trimmed}\n`;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let combinedText = '';

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map(item => item.str ?? '')
      .filter(Boolean)
      .join(' ');

    combinedText += `${pageText}\n\n`;
  }

  return combinedText.trim();
}

async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  return result.value.trim();
}

export async function importFileToMarkdown(file: File): Promise<string> {
  const extension = getFileExtension(file.name);
  const title = toTitleFromFilename(file.name);

  if (extension === 'md' || extension === 'markdown' || file.type.includes('markdown')) {
    return file.text();
  }

  if (extension === 'pdf' || file.type === 'application/pdf') {
    const text = await extractTextFromPdf(file);
    return wrapTextAsMarkdown(text, title);
  }

  if (extension === 'docx' || file.type.includes('officedocument.wordprocessingml.document')) {
    const text = await extractTextFromDocx(file);
    return wrapTextAsMarkdown(text, title);
  }

  const rawText = await file.text();
  return wrapTextAsMarkdown(rawText, title);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/**
 * Converts inline Markdown (bold, italic, code, links) to HTML.
 * Input text must already be HTML-escaped except for the inline Markdown syntax.
 */
function processInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Converts Markdown content to semantic HTML.
 * Produces standalone HTML without external CSS framework dependencies.
 */
export function markdownToHtml(content: string): string {
  // 1. Extract fenced code blocks to protect them from further processing
  const codeBlocks: string[] = [];
  let processed = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(`<pre><code${langAttr}>${escaped}</code></pre>`);
    return `\x00CODE_BLOCK_${codeBlocks.length - 1}\x00`;
  });

  // 2. Extract Markdown tables
  const tableBlocks: string[] = [];
  processed = processed.replace(/((?:\|.+\|\n?)+)/g, (tableText) => {
    const lines = tableText.trimEnd().split('\n');
    if (lines.length < 2) return tableText;
    const parseRow = (line: string): string[] =>
      line.split('|').slice(1, -1).map(c => c.trim());
    const headerCells = parseRow(lines[0]);
    const bodyRows = lines.slice(2).filter(l => l.trim().startsWith('|'));
    const thead = `<thead><tr>${headerCells.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
    const tbody = bodyRows
      .map(row => `<tr>${parseRow(row).map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
      .join('');
    tableBlocks.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
    return `\x00TABLE_BLOCK_${tableBlocks.length - 1}\x00`;
  });

  // 3. Process line by line for block-level elements
  const lines = processed.split('\n');
  const outputParts: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  const closeList = () => {
    if (inUnorderedList) { outputParts.push('</ul>'); inUnorderedList = false; }
    if (inOrderedList) { outputParts.push('</ol>'); inOrderedList = false; }
  };

  for (const line of lines) {
    // Restore code block placeholders
    if (/^\x00CODE_BLOCK_\d+\x00$/.test(line.trim())) {
      closeList();
      const idx = Number(line.trim().replace(/\x00CODE_BLOCK_(\d+)\x00/, '$1'));
      outputParts.push(codeBlocks[idx] ?? '');
      continue;
    }

    // Restore table placeholders
    if (/^\x00TABLE_BLOCK_\d+\x00$/.test(line.trim())) {
      closeList();
      const idx = Number(line.trim().replace(/\x00TABLE_BLOCK_(\d+)\x00/, '$1'));
      outputParts.push(tableBlocks[idx] ?? '');
      continue;
    }

    // Headings
    const h6 = line.match(/^###### (.+)$/);
    const h5 = line.match(/^##### (.+)$/);
    const h4 = line.match(/^#### (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h1 = line.match(/^# (.+)$/);
    if (h6) { closeList(); outputParts.push(`<h6>${processInline(escapeHtml(h6[1]))}</h6>`); continue; }
    if (h5) { closeList(); outputParts.push(`<h5>${processInline(escapeHtml(h5[1]))}</h5>`); continue; }
    if (h4) { closeList(); outputParts.push(`<h4>${processInline(escapeHtml(h4[1]))}</h4>`); continue; }
    if (h3) { closeList(); outputParts.push(`<h3>${processInline(escapeHtml(h3[1]))}</h3>`); continue; }
    if (h2) { closeList(); outputParts.push(`<h2>${processInline(escapeHtml(h2[1]))}</h2>`); continue; }
    if (h1) { closeList(); outputParts.push(`<h1>${processInline(escapeHtml(h1[1]))}</h1>`); continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { closeList(); outputParts.push('<hr />'); continue; }

    // Blockquote
    const bq = line.match(/^> (.+)$/);
    if (bq) {
      closeList();
      outputParts.push(`<blockquote><p>${processInline(escapeHtml(bq[1]))}</p></blockquote>`);
      continue;
    }

    // Unordered list item
    const ul = line.match(/^[-*+] (.+)$/);
    if (ul) {
      if (!inUnorderedList) { if (inOrderedList) { outputParts.push('</ol>'); inOrderedList = false; } outputParts.push('<ul>'); inUnorderedList = true; }
      outputParts.push(`<li>${processInline(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    // Ordered list item
    const ol = line.match(/^\d+\. (.+)$/);
    if (ol) {
      if (!inOrderedList) { if (inUnorderedList) { outputParts.push('</ul>'); inUnorderedList = false; } outputParts.push('<ol>'); inOrderedList = true; }
      outputParts.push(`<li>${processInline(escapeHtml(ol[1]))}</li>`);
      continue;
    }

    // Empty line closes lists and separates paragraphs
    if (line.trim() === '') {
      closeList();
      outputParts.push('');
      continue;
    }

    // Regular paragraph line
    closeList();
    outputParts.push(`<p>${processInline(escapeHtml(line))}</p>`);
  }

  closeList();

  // Merge consecutive <p> tags separated by empty lines into single blocks
  return outputParts.filter(p => p !== undefined).join('\n');
}

const SHARED_CSS = `
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 2cm 2.5cm;
  }
  h1 { font-size: 2em; margin: 1.5em 0 0.5em; color: #111; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; margin: 1.4em 0 0.4em; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
  h3 { font-size: 1.25em; margin: 1.2em 0 0.3em; color: #333; }
  h4 { font-size: 1.1em; margin: 1em 0 0.25em; color: #444; }
  h5, h6 { font-size: 1em; margin: 0.8em 0 0.2em; color: #555; }
  p { margin: 0.6em 0; }
  ul, ol { margin: 0.6em 0; padding-left: 2em; }
  li { margin: 0.25em 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid #6366f1;
    background: #f8f8ff;
    color: #444;
    font-style: italic;
  }
  pre {
    background: #f4f4f4;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1em;
    overflow-x: auto;
    font-size: 0.9em;
  }
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.9em;
    background: #f4f4f4;
    padding: 0.1em 0.3em;
    border-radius: 3px;
  }
  pre code { background: none; padding: 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.95em;
  }
  th {
    background: #f0f0f0;
    font-weight: bold;
    text-align: left;
    padding: 0.5em 0.75em;
    border: 1px solid #ccc;
  }
  td { padding: 0.4em 0.75em; border: 1px solid #ccc; }
  tr:nth-child(even) td { background: #fafafa; }
  a { color: #4f46e5; text-decoration: underline; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
  img { max-width: 100%; height: auto; }
`;

const PRINT_CSS = `
  @page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 2.5cm;
  }
  @page :first {
    margin-top: 3cm;
  }
  @media print {
    body { padding: 0; margin: 0; max-width: none; font-size: 10pt; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    h2, h3, h4, h5, h6 { page-break-after: avoid; }
    p { orphans: 3; widows: 3; }
    pre, blockquote, table, figure { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
    a[href]::after { content: ' (' attr(href) ')'; font-size: 0.8em; color: #666; }
    a[href^="#"]::after { content: ''; }
  }
`;

export function buildHtmlDocument(markdown: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const body = markdownToHtml(markdown);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${SHARED_CSS}${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Builds an HTML document specifically optimized for PDF printing.
 * Uses @page and @media print rules for proper margins and page breaks.
 */
export function buildPrintHtmlDocument(markdown: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const body = markdownToHtml(markdown);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    ${SHARED_CSS}
    ${PRINT_CSS}
    @media screen {
      body { padding: 2cm 2.5cm; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Builds a Word-compatible HTML document (.doc) that Microsoft Word,
 * LibreOffice Writer and Google Docs can open and edit correctly.
 */
export function buildWordDocument(markdown: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const body = markdownToHtml(markdown);
  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="fr">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="FractalIAworker" />
  <title>${safeTitle}</title>
  <!--[if gte mso 9]><xml>
   <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
   </w:WordDocument>
  </xml><![endif]-->
  <style>
    ${SHARED_CSS}
    /* Word-specific styles */
    @page WordSection1 {
      size: 21cm 29.7cm;
      margin: 2.5cm 2cm 2.5cm 2.5cm;
      mso-header-margin: 1.4cm;
      mso-footer-margin: 1.4cm;
      mso-paper-source: 0;
    }
    body { page: WordSection1; }
    p.MsoNormal, li.MsoNormal { margin: 0; }
    h1 { mso-style-next: Normal; page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    h2, h3, h4 { mso-style-next: Normal; }
    div { mso-line-height-rule: exactly; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function encodeMarkdownForShare(markdown: string): string {
  const bytes = new TextEncoder().encode(markdown);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeMarkdownFromShare(payload: string): string {
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
