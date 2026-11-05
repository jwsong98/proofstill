import { parse } from 'csv-parse/browser/esm/sync';

export type DocumentFormat =
  | { kind: 'markdown' }
  | { kind: 'json' }
  | { kind: 'csv'; rows: string[][] }
  | { kind: 'invalid'; message: string };

export function documentFormat(content: string, filename = ''): DocumentFormat {
  const extension = filename.split('.').pop()?.toLowerCase();
  const text = content.replace(/^\uFEFF/, '').trim();
  if (extension === 'json' || text.startsWith('{') || text.startsWith('[')) {
    try {
      JSON.parse(text);
      return { kind: 'json' };
    } catch {
      if (extension === 'json') return { kind: 'invalid', message: '완전한 JSON이 아니어서 원문으로 표시합니다.' };
    }
  }
  if (extension === 'csv' || (!['md', 'markdown'].includes(extension ?? '') && text.includes(','))) {
    try {
      const rows = parse(content, { bom: true, skip_empty_lines: true }) as string[][];
      if (extension === 'csv' || (rows.length > 1 && rows[0]?.length > 1)) return { kind: 'csv', rows };
    } catch {
      if (extension === 'csv') return { kind: 'invalid', message: 'CSV 형식을 읽을 수 없어 원문으로 표시합니다.' };
    }
  }
  return { kind: 'markdown' };
}

export async function prettyJson(content: string) {
  const [{ format }, babel, estree] = await Promise.all([
    import('prettier/standalone'), import('prettier/plugins/babel'), import('prettier/plugins/estree'),
  ]);
  // Format source tokens so large integers and duplicate keys remain intact.
  return format(content.replace(/^\uFEFF/, ''), { parser: 'json-stringify', plugins: [babel, estree], tabWidth: 2, printWidth: 72 });
}
