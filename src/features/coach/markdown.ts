export type MarkdownSpan = { text: string; bold: boolean; italic: boolean };

export type MarkdownListItem = {
  spans: MarkdownSpan[];
  children: MarkdownList | null;
};

export type MarkdownList = { ordered: boolean; items: MarkdownListItem[] };

export type MarkdownBlock =
  | { type: "paragraph"; lines: MarkdownSpan[][] }
  | { type: "heading"; spans: MarkdownSpan[] }
  | ({ type: "list" } & MarkdownList);

const listPattern = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const headingPattern = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;

export function parseInline(text: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|\*(\S(?:.*?\S)?)\*|`([^`]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last)
      spans.push({ text: text.slice(last, index), bold: false, italic: false });
    if (match[1] !== undefined || match[2] !== undefined)
      spans.push(
        ...parseInline(match[1] ?? match[2]).map((span) => ({
          ...span,
          bold: true,
        })),
      );
    else if (match[3] !== undefined)
      spans.push({ text: match[3], bold: false, italic: true });
    else spans.push({ text: match[4], bold: false, italic: false });
    last = index + match[0].length;
  }
  if (last < text.length)
    spans.push({ text: text.slice(last), bold: false, italic: false });
  return spans.filter((span) => span.text.length > 0);
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: MarkdownSpan[][] | null = null;
  let list: (MarkdownList & { type: "list" }) | null = null;
  let lastItem: MarkdownListItem | null = null;

  const close = () => {
    paragraph = null;
    list = null;
    lastItem = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (!raw.trim()) {
      close();
      continue;
    }
    const heading = headingPattern.exec(raw);
    if (heading) {
      close();
      blocks.push({ type: "heading", spans: parseInline(heading[1]) });
      continue;
    }
    const item = listPattern.exec(raw);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const nested = item[1].replace(/\t/g, "  ").length >= 2;
      const entry: MarkdownListItem = {
        spans: parseInline(item[3]),
        children: null,
      };
      paragraph = null;
      if (nested && lastItem) {
        lastItem.children ??= { ordered, items: [] };
        lastItem.children.items.push(entry);
        continue;
      }
      if (!list || list.ordered !== ordered) {
        list = { type: "list", ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(entry);
      lastItem = entry;
      continue;
    }
    if (list && lastItem && /^\s+/.test(raw)) {
      const target: MarkdownListItem =
        lastItem.children?.items.at(-1) ?? lastItem;
      target.spans.push(
        { text: " ", bold: false, italic: false },
        ...parseInline(raw.trim()),
      );
      continue;
    }
    list = null;
    lastItem = null;
    if (!paragraph) {
      paragraph = [];
      blocks.push({ type: "paragraph", lines: paragraph });
    }
    paragraph.push(parseInline(raw.trim()));
  }
  return blocks;
}

function spansText(spans: readonly MarkdownSpan[]) {
  return spans.map((span) => span.text).join("");
}

function listText(list: MarkdownList): string[] {
  return list.items.flatMap((item) => [
    spansText(item.spans),
    ...(item.children ? listText(item.children) : []),
  ]);
}

export function markdownPlainText(source: string) {
  return parseMarkdown(source)
    .flatMap((block) =>
      block.type === "paragraph"
        ? block.lines.map(spansText)
        : block.type === "heading"
          ? [spansText(block.spans)]
          : listText(block),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
