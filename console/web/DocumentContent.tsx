import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { documentFormat, prettyJson } from './documentFormat.ts';
import './styles/document-content.css';

export function DocumentContent({ content, filename, original }: {
  content: string; filename?: string; original?: ReactNode;
}) {
  const format = useMemo(() => documentFormat(content, filename), [content, filename]);
  const [formatted, setFormatted] = useState<{ source: string; text: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (format.kind === 'json') void prettyJson(content)
      .then(text => { if (alive) setFormatted({ source: content, text }); })
      .catch(() => { if (alive) setFormatted({ source: content, text: content }); });
    return () => { alive = false; };
  }, [content, format]);
  return <div className="document-content">
    {format.kind === 'json' ? <pre aria-label="JSON 본문"><code>{formatted?.source === content ? formatted.text : content}</code></pre>
      : format.kind === 'csv' ? <div className="document-table-scroll"><table aria-label="CSV 본문"><tbody>
        {format.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}
      </tbody></table></div>
      : format.kind === 'invalid' ? <><p role="status">{format.message}</p><pre>{content}</pre></>
      : <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>{alt || '이미지'}</span> }}>{content}</ReactMarkdown>}
    <details className="document-original"><summary>원문 보기</summary>{original ?? <pre>{content}</pre>}</details>
  </div>;
}
