import { Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  parseMarkdown,
  type MarkdownList,
  type MarkdownSpan,
} from "../markdown";

function Spans({ spans }: { spans: readonly MarkdownSpan[] }) {
  return spans.map((span, index) => {
    let node: React.ReactNode = span.text;
    if (span.italic) node = <em>{node}</em>;
    if (span.bold) node = <strong className="font-semibold">{node}</strong>;
    return <Fragment key={index}>{node}</Fragment>;
  });
}

function List({
  list,
  nested = false,
}: {
  list: MarkdownList;
  nested?: boolean;
}) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "flex flex-col gap-1 pl-5",
        list.ordered ? "list-decimal" : "list-disc",
        nested && "mt-1",
      )}
    >
      {list.items.map((item, index) => (
        <li key={index} className="pl-0.5 marker:text-muted-foreground">
          <Spans spans={item.spans} />
          {item.children && <List list={item.children} nested />}
        </li>
      ))}
    </Tag>
  );
}

export function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {parseMarkdown(text).map((block, index) => {
        if (block.type === "heading")
          return (
            <p key={index} className="font-semibold">
              <Spans spans={block.spans} />
            </p>
          );
        if (block.type === "list") return <List key={index} list={block} />;
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Spans spans={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
