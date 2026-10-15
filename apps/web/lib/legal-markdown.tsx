import Link from 'next/link';
import { createElement, Fragment, type ReactNode } from 'react';

/**
 * Minimal markdown → React for legal docs (headings, lists, tables, links, bold).
 * ponytail: no markdown dependency; upgrade to a library only if docs need more syntax.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let part = 0;
  let match = re.exec(text);
  while (match !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const key = `${keyPrefix}-${part++}`;
    if (match[2] && match[3]) {
      const href = match[3];
      const label = match[2];
      nodes.push(
        href.startsWith('/') ? (
          <Link key={key} href={href}>
            {label}
          </Link>
        ) : (
          <a key={key} href={href} rel="noopener noreferrer">
            {label}
          </a>
        ),
      );
    } else if (match[4]) {
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<code key={key}>{match[5]}</code>);
    }
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isTableSep(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line.trim());
}

function renderTable(rows: string[], key: string): ReactNode {
  const parsed = rows
    .filter((row) => !isTableSep(row))
    .map((row) =>
      row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
  if (parsed.length === 0) return null;
  const [header, ...body] = parsed;
  return (
    <table key={key}>
      <thead>
        <tr>
          {header.map((c) => (
            <th key={`${key}-h-${c}`}>{inline(c, `${key}-h-${c}`)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((r) => {
          const rowKey = `${key}-r-${r.join('|')}`;
          return (
            <tr key={rowKey}>
              {r.map((c) => (
                <td key={`${rowKey}-c-${c}`}>{inline(c, `${rowKey}-c-${c}`)}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function legalMarkdownToReact(markdown: string): ReactNode {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let listType: 'ul' | 'ol' | null = null;
  let listItems: ReactNode[] = [];
  let block = 0;

  const flushList = () => {
    if (!listType) return;
    const Tag = listType;
    out.push(<Tag key={`list-${block++}`}>{listItems}</Tag>);
    listType = null;
    listItems = [];
  };

  const pushListItem = (type: 'ul' | 'ol', content: string) => {
    if (listType !== type) {
      flushList();
      listType = type;
    }
    const key = `li-${block}-${listItems.length}`;
    listItems.push(<li key={key}>{inline(content, key)}</li>);
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      flushList();
      out.push(<hr key={`hr-${block++}`} />);
      i += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      flushList();
      const tableRows: string[] = [];
      while (i < lines.length && isTableRow((lines[i] ?? '').trim())) {
        tableRows.push(lines[i] ?? '');
        i += 1;
      }
      out.push(renderTable(tableRows, `table-${block++}`));
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length as 1 | 2 | 3 | 4;
      const key = `h-${block++}`;
      out.push(createElement(`h${level}`, { key }, inline(heading[2], key)));
      i += 1;
      continue;
    }

    const ol = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (ol) {
      pushListItem('ol', ol[2]);
      i += 1;
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ul) {
      pushListItem('ul', ul[1]);
      i += 1;
      continue;
    }

    const nested = /^ {2,}(\d+)\.\s+(.*)$/.exec(line);
    if (nested) {
      pushListItem('ol', nested[2]);
      i += 1;
      continue;
    }

    flushList();
    const key = `p-${block++}`;
    out.push(<p key={key}>{inline(trimmed, key)}</p>);
    i += 1;
  }

  flushList();
  return <Fragment>{out}</Fragment>;
}
