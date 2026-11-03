export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; label: string; target: string; href: string }
  | { kind: 'reference'; label: string; target: string; href: null };

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function inlineTokens(text: string): InlineToken[] {
  const pattern = /(`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|https?:\/\/[^\s<]+)/g;
  const tokens: InlineToken[] = []; let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'text', text: text.slice(cursor, index) });
    const value = match[0];
    if (value.startsWith('`')) tokens.push({ kind: 'code', text: value.slice(1, -1) });
    else if (value.startsWith('[')) {
      const split = value.indexOf(']('), label = value.slice(1, split), target = value.slice(split + 2, -1), href = safeUrl(target);
      tokens.push(href ? { kind: 'link', label, target, href } : { kind: 'reference', label, target, href: null });
    } else {
      const href = safeUrl(value);
      if (href) tokens.push({ kind: 'link', label: value, target: value, href });
      else tokens.push({ kind: 'reference', label: value, target: value, href: null });
    }
    cursor = index + value.length;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', text: text.slice(cursor) });
  return tokens;
}
