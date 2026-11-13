import { useState } from 'react';
import styles from './MarkdownArticleContent.module.css';

function isSafeUrl(value, image = false) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/') && !value.startsWith('//')) {
    return !image || value.startsWith('/uploads/images/blog/');
  }
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function renderInline(text) {
  const expression = /(!?\[[^\]]+\]\([^)]+\)|\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = text.split(expression).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${index}-${part}`;
    if (part.startsWith('![')) {
      const match = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (match && isSafeUrl(match[2], true)) {
        return <img className={styles.inlineImage} key={key} src={match[2]} alt={match[1]} loading="lazy" />;
      }
    } else if (part.startsWith('[')) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match && isSafeUrl(match[2])) {
        const external = /^https?:\/\//i.test(match[2]);
        return (
          <a key={key} href={match[2]} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
            {match[1]}
          </a>
        );
      }
    } else if (part.startsWith('**') || part.startsWith('__')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    } else if (part.startsWith('*') || part.startsWith('_')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function copyCode() {
    if (!navigator.clipboard?.writeText) {
      setCopyError('Clipboard access is unavailable.');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopyError('');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError('Code could not be copied.');
    }
  }

  return (
    <figure className={styles.codeBlock}>
      <figcaption className={styles.codeHeader}>
        <span>{language || 'Code'}</span>
        <span className={styles.codeActions}>
          {copyError && <span role="alert">{copyError}</span>}
          <button type="button" onClick={copyCode}>{copied ? 'Copied' : 'Copy code'}</button>
        </span>
      </figcaption>
      <pre><code>{code}</code></pre>
    </figure>
  );
}

function parseBlocks(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence[1], content: codeLines.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length + 1, 6), content: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', content: quote.join(' ') });
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(orderedList ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: orderedList ? 'orderedList' : 'unorderedList', items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()
      && !/^(?:```|#{1,6}\s|>|[-*+]\s|\d+\.\s)/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraph.join(' ') });
  }

  return blocks;
}

export default function MarkdownArticleContent({ markdown }) {
  return (
    <div className={styles.articleBody}>
      {parseBlocks(markdown).map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === 'heading') {
          const Heading = `h${block.level}`;
          return <Heading key={key}>{renderInline(block.content)}</Heading>;
        }
        if (block.type === 'paragraph') return <p key={key}>{renderInline(block.content)}</p>;
        if (block.type === 'quote') return <blockquote key={key}>{renderInline(block.content)}</blockquote>;
        if (block.type === 'rule') return <hr key={key} />;
        if (block.type === 'code') return <CodeBlock key={key} code={block.content} language={block.language} />;
        const List = block.type === 'orderedList' ? 'ol' : 'ul';
        return (
          <List key={key}>
            {block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{renderInline(item)}</li>)}
          </List>
        );
      })}
    </div>
  );
}
