export interface DetectedSection {
  id: string;
  title: string;
  level: number;
  content: string;
  children: DetectedSection[];
  expanded?: boolean;
  titlePosition: number;
  startPosition: number;
  endPosition: number;
}

export interface RawSection {
  title: string;
  level: number;
  position: number;
}

export const COMMON_PATTERNS: { level: number; regex: RegExp }[] = [
  { level: 1, regex: /^(TOME|Tome|LIVRE|Livre|PREMIÈRE PARTIE|DEUXIÈME PARTIE|TROISIÈME PARTIE|QUATRIÈME PARTIE|CINQUIÈME PARTIE|Première partie|Deuxième partie|Troisième partie|Quatrième partie|Cinquième partie|PART\s+[IVXLCDM\d]+|Part\s+[IVXLCDM\d]+)\s*[:\-–—]?\s*.*/i },
  { level: 1, regex: /^(VOLUME|Volume)\s+[IVXLCDM\d]+/i },
  { level: 1, regex: /^(PROLOGUE|ÉPILOGUE|Prologue|Épilogue|PRÉFACE|Préface)\s*$/i },
  { level: 2, regex: /^(CHAPITRE|Chapitre|CHAPTER)\s+[IVXLCDM\d]+\s*[:\-–—]?\s*.*/i },
  { level: 2, regex: /^(Chap\.|CHAP\.)\s*\d+/i },
  { level: 2, regex: /^\d+\s*[:\-–—\.]\s+[A-Z][a-zÀ-ÿ]/m },
  { level: 3, regex: /^(Scène|SCÈNE|Scene)\s+\d+/i },
  { level: 3, regex: /^(SECTION|Section)\s+\d+/i },
  { level: 3, regex: /^\*\*\*\s*$/m },
  { level: 3, regex: /^[-–—]{3,}\s*$/m },
];

export function deduplicateSections(sections: RawSection[]): RawSection[] {
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const deduped: RawSection[] = [];

  for (const section of sorted) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(last.position - section.position) > 50) {
      deduped.push(section);
    } else if (section.level < last.level) {
      deduped[deduped.length - 1] = section;
    }
  }

  return deduped.filter((section, index, self) =>
    index === self.findIndex(s => s.title === section.title && Math.abs(s.position - section.position) < 100)
  );
}

export function detectByCommonPatterns(content: string): RawSection[] {
  const sections: RawSection[] = [];
  for (const pattern of COMMON_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, 'gm');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const fullLine = content.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
      if (fullLine.length < 3 || /^[-*_]{3,}$/.test(fullLine)) continue;
      sections.push({
        title: fullLine || match[0],
        level: pattern.level,
        position: match.index,
      });
    }
  }
  return deduplicateSections(sections);
}

export function applyPatternsToDocument(
  patterns: { level: number; regex: string }[],
  content: string
): RawSection[] {
  const sections: RawSection[] = [];
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.regex, 'gm');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineEnd = content.indexOf('\n', match.index);
        const fullLine = content.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
        sections.push({
          title: fullLine || match[0],
          level: pattern.level,
          position: match.index,
        });
      }
    } catch (e) {
      console.warn(`Invalid pattern regex: ${pattern.regex}`, e);
    }
  }

  sections.sort((a, b) => a.position - b.position);
  const deduped: RawSection[] = [];
  for (const section of sections) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(last.position - section.position) > 50) {
      deduped.push(section);
    } else if (section.level < last.level) {
      deduped[deduped.length - 1] = section;
    }
  }
  return deduped;
}

export function buildHierarchicalStructure(
  sections: RawSection[],
  fullContent: string
): DetectedSection[] {
  const result: DetectedSection[] = [];
  const stack: DetectedSection[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];

    const titleEndIndex = fullContent.indexOf('\n', section.position);
    const contentStart = titleEndIndex !== -1 ? titleEndIndex + 1 : section.position + section.title.length;
    const contentEnd = nextSection ? nextSection.position : fullContent.length;

    const sectionContent = fullContent.substring(contentStart, Math.min(contentEnd, contentStart + 500)).trim();

    const newSection: DetectedSection = {
      id: `section-${Date.now()}-${i}`,
      title: section.title,
      level: section.level,
      content: sectionContent.length > 200 ? sectionContent.substring(0, 200) + '...' : sectionContent,
      children: [],
      expanded: section.level <= 2,
      titlePosition: section.position,
      startPosition: contentStart,
      endPosition: contentEnd,
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      result.push(newSection);
    } else {
      stack[stack.length - 1].children.push(newSection);
    }

    stack.push(newSection);
  }

  return result;
}

export function reconstructDocument(sections: DetectedSection[], originalContent: string): string {
  if (sections.length === 0) {
    return `# Document importé\n\n${originalContent}`;
  }

  let markdown = '';
  const processSection = (section: DetectedSection) => {
    const headingPrefix = '#'.repeat(section.level);
    markdown += `${headingPrefix} ${section.title}\n\n`;

    let contentEnd = section.endPosition;
    if (section.children.length > 0) {
      contentEnd = section.children[0].titlePosition;
    }

    if (section.startPosition < contentEnd) {
      const sectionContent = originalContent
        .substring(section.startPosition, contentEnd)
        .trim()
        .replace(/^#+\s*[^\n]+\n*/gm, '')
        .trim();

      if (sectionContent) {
        markdown += `${sectionContent}\n\n`;
      }
    }

    section.children.forEach(child => processSection(child));
  };

  sections.forEach(section => processSection(section));
  return markdown.trim();
}

export function countSections(sections: DetectedSection[]): number {
  return sections.reduce((count, s) => count + 1 + countSections(s.children), 0);
}
