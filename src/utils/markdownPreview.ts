export function extractUrls(content: string): { text: string; url: string }[] {
  const urls: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    if (!seen.has(match[2])) {
      urls.push({ text: match[1], url: match[2] });
      seen.add(match[2]);
    }
  }
  const contentWithoutLinks = content.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '');
  const bareUrlRegex = /https?:\/\/[^\s)\]>,"]+/g;
  while ((match = bareUrlRegex.exec(contentWithoutLinks)) !== null) {
    if (!seen.has(match[0])) {
      urls.push({ text: match[0], url: match[0] });
      seen.add(match[0]);
    }
  }
  return urls;
}

export function renderPreview(content: string): string {
  let html = content.replace(
    /```mermaid\n([\s\S]*?)```/g,
    '<div class="mermaid-container my-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm"><div class="mermaid">$1</div></div>'
  );

  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono shadow-inner"><code>$2</code></pre>'
  );

  html = html
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-bold mt-3 mb-1 text-gray-800">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-800 border-b border-gray-200 pb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900 border-b-2 border-blue-200 pb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-900">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><span class="text-green-600">✅</span> <span class="line-through text-gray-500">$1</span></li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="ml-4 flex items-center gap-2"><span class="text-gray-400">☐</span> $1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 py-0.5">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal py-0.5">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 italic text-gray-700 my-3 rounded-r">$1</blockquote>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 hover:underline font-medium" target="_blank">$1</a>')
    .replace(/^---$/gm, '<hr class="my-6 border-gray-300" />');

  html = html.replace(/((\|.+\|\n?)+)/g, (tableMatch) => {
    const rows = tableMatch.trim().split('\n').filter(row => row.trim());
    if (rows.length < 2) return tableMatch;

    let tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden shadow-sm">';

    rows.forEach((row, index) => {
      const cells = row.split('|').filter(c => c.trim());
      if (cells.some(c => c.match(/^[-:]+$/))) return;

      if (index === 0) {
        tableHtml += '<thead class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"><tr>';
        cells.forEach(cell => {
          tableHtml += `<th class="px-4 py-3 text-left font-semibold text-sm uppercase tracking-wider">${cell.trim()}</th>`;
        });
        tableHtml += '</tr></thead><tbody class="bg-white divide-y divide-gray-200">';
      } else {
        const rowClass = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';
        tableHtml += `<tr class="${rowClass} hover:bg-blue-50 transition-colors">`;
        cells.forEach(cell => {
          tableHtml += `<td class="px-4 py-3 text-sm text-gray-700">${cell.trim()}</td>`;
        });
        tableHtml += '</tr>';
      }
    });

    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  html = html
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />');

  let result = `<div class="prose max-w-none"><p class="my-2">${html}</p>`;

  const urls = extractUrls(content);
  if (urls.length > 0) {
    result += `<div class="mt-8 pt-4 border-t-2 border-blue-100">
      <p class="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">🔗 Références</p>
      <div class="overflow-x-auto"><table class="min-w-full border-collapse border border-gray-200 text-sm rounded-lg overflow-hidden">
        <thead class="bg-blue-50"><tr>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200 w-8">#</th>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">Texte</th>
          <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">URL</th>
        </tr></thead>
        <tbody>
          ${urls.map((u, i) => `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
            <td class="px-3 py-1.5 border border-gray-200 text-gray-400 text-center">${i + 1}</td>
            <td class="px-3 py-1.5 border border-gray-200 font-medium text-gray-700">${u.text}</td>
            <td class="px-3 py-1.5 border border-gray-200 text-blue-600 break-all"><a href="${u.url}" target="_blank" class="hover:underline">${u.url}</a></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }

  result += '</div>';
  return result;
}
