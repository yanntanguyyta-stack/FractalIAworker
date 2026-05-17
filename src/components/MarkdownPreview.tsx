import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { extractUrls } from '../utils/markdownPreview';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    span: [...(defaultSchema.attributes?.span || []), ['className']],
    div: [...(defaultSchema.attributes?.div || []), ['className']],
  },
};

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  const urls = extractUrls(content);

  return (
    <div className={`prose max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold mt-6 mb-3 text-gray-900 border-b-2 border-blue-200 pb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-bold mt-4 mb-2 text-gray-800 border-b border-gray-200 pb-1" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-bold mt-3 mb-1 text-gray-800" {...props} />
          ),
          p: ({ node, ...props }) => <p className="my-2" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 italic text-gray-700 my-3 rounded-r"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-gray-300" />,
          ul: ({ node, ...props }) => <ul className="my-2 ml-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="my-2 ml-4 list-decimal" {...props} />,
          li: ({ node, children, ...props }) => (
            <li className="ml-4 py-0.5" {...props}>
              {children}
            </li>
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table
                className="min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden shadow-sm"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="bg-white divide-y divide-gray-200" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="px-4 py-3 text-left font-semibold text-sm uppercase tracking-wider"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-sm text-gray-700" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-blue-50 transition-colors" {...props} />
          ),
          code: ({ node, className: codeClass, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClass || '');
            const lang = match?.[1];
            const isInline = !codeClass;

            if (isInline) {
              return (
                <code
                  className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            if (lang === 'mermaid') {
              return (
                <div className="mermaid-container my-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
                  <div className="mermaid">{String(children).replace(/\n$/, '')}</div>
                </div>
              );
            }

            return (
              <code className={codeClass} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ node, children, ...props }) => {
            const childArray = React.Children.toArray(children);
            const firstChild = childArray[0] as React.ReactElement | undefined;
            const codeClass = (firstChild?.props as { className?: string } | undefined)?.className || '';
            if (/language-mermaid/.test(codeClass)) {
              return <>{children}</>;
            }
            return (
              <pre
                className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono shadow-inner"
                {...props}
              >
                {children}
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {urls.length > 0 && (
        <div className="mt-8 pt-4 border-t-2 border-blue-100">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">
            🔗 Références
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200 text-sm rounded-lg overflow-hidden">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200 w-8">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">
                    Texte
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {urls.map((u, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 border border-gray-200 text-gray-400 text-center">
                      {i + 1}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-200 font-medium text-gray-700">
                      {u.text}
                    </td>
                    <td className="px-3 py-1.5 border border-gray-200 text-blue-600 break-all">
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {u.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownPreview;
