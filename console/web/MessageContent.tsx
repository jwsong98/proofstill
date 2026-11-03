import { Fragment, type ReactNode } from 'react';
import { inlineTokens } from './messageFormat.ts';

function inline(text: string): ReactNode[] {
  return inlineTokens(text).map((token, index) => {
    if (token.kind === 'text') return token.text;
    if (token.kind === 'code') return <code className="message-code" key={index}>{token.text}</code>;
    if (token.kind === 'link') return <a className="message-link" href={token.href} target="_blank" rel="noreferrer" title={token.target} key={index}>{token.label}</a>;
    return <span className="message-reference" title={token.target} key={index}><span>{token.label}</span><code>{token.target}</code></span>;
  });
}

export function MessageContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(); const code: string[] = []; index++;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre className="message-code-block" key={`code-${index}`}><span>{language || 'text'}</span><code>{code.join('\n')}</code></pre>); continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { const level = heading[1].length; blocks.push(<div className={`message-heading level-${level}`} key={`heading-${index}`}>{inline(heading[2])}</div>); index++; continue; }
    const unordered = /^[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) { const item = /^[-*]\s+(.+)$/.exec(lines[index]); if (!item) break; items.push(item[1]); index++; }
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) { const item = /^\d+\.\s+(.+)$/.exec(lines[index]); if (!item) break; items.push(item[1]); index++; }
      blocks.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    if (!line.trim()) { index++; continue; }
    const paragraph: string[] = [line]; index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^```|^[-*]\s+|^\d+\.\s+/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`p-${index}`}>{paragraph.map((part, partIndex) => <Fragment key={partIndex}>{partIndex > 0 && <br />}{inline(part)}</Fragment>)}</p>);
  }
  return <div className="message-content">{blocks}</div>;
}
