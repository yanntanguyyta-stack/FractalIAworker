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

export function markdownToHtml(content: string): string {
  const mermaidBlocks: string[] = [];
  const placeholderContent = content.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code) => {
    mermaidBlocks.push(escapeHtml(code));
    return `__MERMAID_BLOCK_${mermaidBlocks.length - 1}__`;
  });

  let html = escapeHtml(placeholderContent);

  html = html.replace(/__MERMAID_BLOCK_(\d+)__/g, (_match, index) => {
    const code = mermaidBlocks[Number(index)] ?? '';
    return `<div class="mermaid">${code}</div>`;
  });

  html = html
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">$1</blockquote>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>')
    .replace(/^---$/gm, '<hr class="my-4 border-gray-300" />')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.match(/^[-:]+$/))) {
        return '';
      }
      return `<tr>${cells.map(c => `<td class=\"border border-gray-300 px-3 py-2\">${c.trim()}</td>`).join('')}</tr>`;
    })
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />');

  return `<div class="prose max-w-none"><p class="my-2">${html}</p></div>`;
}

export function buildHtmlDocument(markdown: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const body = markdownToHtml(markdown);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: 'Inter', 'Segoe UI', sans-serif; margin: 32px; color: #0f172a; }
    h1, h2, h3 { color: #1e293b; }
    table { border-collapse: collapse; margin: 16px 0; }
    code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
    blockquote { background: #f8fafc; padding: 8px 16px; border-radius: 8px; }
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
