import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
} from 'docx';

type DocxChild = Paragraph | Table;

// Mapping markdown heading depth (1-6) to DOCX HeadingLevel
const HEADING_LEVEL_MAP: Record<number, HeadingLevel> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Parses inline markdown (bold, italic, code) into typed segments.
 */
function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Match bold+italic, bold, italic, code in order
  // Matches (in order): bold+italic (***), bold (**), italic (*), inline code (`)
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], bold: true });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4], italic: true });
    } else if (match[5] !== undefined) {
      segments.push({ text: match[5], code: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.filter(s => s.text.length > 0);
}

function segmentsToTextRuns(segments: InlineSegment[]): TextRun[] {
  return segments.map(
    s =>
      new TextRun({
        text: s.text,
        bold: s.bold ?? false,
        italics: s.italic ?? false,
        font: s.code ? 'Courier New' : undefined,
        size: s.code ? 18 : undefined, // 9pt in half-points
      })
  );
}

function makeHeading(text: string, depth: number): Paragraph {
  const level = HEADING_LEVEL_MAP[depth] ?? HeadingLevel.HEADING_6;
  return new Paragraph({
    text,
    heading: level,
  });
}

function makeParagraph(text: string): Paragraph {
  if (!text.trim()) return new Paragraph({});
  const segments = parseInline(text);
  return new Paragraph({ children: segmentsToTextRuns(segments) });
}

function makeListItem(text: string, ordered: boolean, _index: number): Paragraph {
  const segments = parseInline(text);
  return new Paragraph({
    children: segmentsToTextRuns(segments),
    bullet: ordered ? undefined : { level: 0 },
    numbering: ordered ? { reference: 'default-numbering', level: 0 } : undefined,
  });
}

function parseMarkdownTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;
  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(c => c.trim());

  const headers = parseRow(lines[0]);
  const bodyRows = lines.slice(2).filter(l => l.trim().startsWith('|'));

  const headerRow = new TableRow({
    children: headers.map(
      cell =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: cell, bold: true })],
              alignment: AlignmentType.LEFT,
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
            left: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
            right: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
          },
          shading: { fill: 'F0F0F0' },
          width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
        })
    ),
  });

  const dataRows = bodyRows.map(
    row =>
      new TableRow({
        children: parseRow(row).map(
          cell =>
            new TableCell({
              children: [makeParagraph(cell)],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
              },
              width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
            })
        ),
      })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

/**
 * Converts a Markdown string to an array of DOCX document children
 * (Paragraphs and Tables).
 */
export function markdownToDocxChildren(markdown: string): DocxChild[] {
  const children: DocxChild[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join('\n'),
              font: 'Courier New',
              size: 18,
            }),
          ],
        })
      );
      continue;
    }

    // Markdown table (line starts with '|')
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseMarkdownTable(tableLines);
      if (table) {
        children.push(table);
        children.push(new Paragraph({})); // spacing after table
      }
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6}) (.+)$/);
    if (hMatch) {
      children.push(makeHeading(hMatch[2], hMatch[1].length));
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      children.push(new Paragraph({ text: '', border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } } }));
      i++;
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^> (.+)$/);
    if (bqMatch) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: bqMatch[1], italics: true, color: '666666' })],
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: '6366F1' } },
        })
      );
      i++;
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*+] (.+)$/);
    if (ulMatch) {
      children.push(makeListItem(ulMatch[1], false, 0));
      i++;
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\d+)\. (.+)$/);
    if (olMatch) {
      children.push(makeListItem(olMatch[2], true, parseInt(olMatch[1], 10)));
      i++;
      continue;
    }

    // Empty line → spacing paragraph
    if (line.trim() === '') {
      children.push(new Paragraph({ spacing: { before: 100, after: 100 } }));
      i++;
      continue;
    }

    // Regular paragraph
    children.push(makeParagraph(line));
    i++;
  }

  return children;
}

/**
 * Generates a .docx Blob from a Markdown string and document title.
 */
export async function buildDocxBlob(markdown: string, title: string): Promise<Blob> {
  const children = markdownToDocxChildren(markdown);

  // Prepend title as H1 if not already starting with one
  const firstLine = markdown.trimStart().split('\n')[0] ?? '';
  const startsWithH1 = /^# /.test(firstLine);
  const allChildren: DocxChild[] = startsWithH1
    ? children
    : [makeHeading(title, 1), ...children];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: allChildren,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}
