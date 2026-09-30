"use client";

import { Fragment, type ReactNode } from "react";
import { Katex } from "@/components/studio/Katex";

/**
 * Markdown-lite + KaTeX renderer for agent replies (headings, lists, **bold**, tables, code, links).
 * Math islands \( \), \[ \], $…$, $$…$$ render through KaTeX (Lebanese Word-Equation formatting).
 */

const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
const BOLD_RE = /(\*\*[^*]+\*\*)/g;
const URL_RE = /(https?:\/\/[^\s)،]+)/g;

function unwrap(chunk: string): { tex: string; display: boolean } | null {
  if (chunk.startsWith("$$") && chunk.endsWith("$$") && chunk.length > 4) return { tex: chunk.slice(2, -2), display: true };
  if (chunk.startsWith("\\[") && chunk.endsWith("\\]")) return { tex: chunk.slice(2, -2), display: true };
  if (chunk.startsWith("\\(") && chunk.endsWith("\\)")) return { tex: chunk.slice(2, -2), display: false };
  if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length > 2) return { tex: chunk.slice(1, -1), display: false };
  return null;
}

function renderPlain(text: string, key: string): ReactNode[] {
  return text.split(BOLD_RE).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${key}-b${index}`}>{renderLinks(part.slice(2, -2), `${key}-b${index}`)}</strong>;
    }
    return <Fragment key={`${key}-t${index}`}>{renderLinks(part, `${key}-t${index}`)}</Fragment>;
  });
}

function renderLinks(text: string, key: string): ReactNode[] {
  return text.split(URL_RE).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={`${key}-l${index}`} href={part} target="_blank" rel="noreferrer noopener" dir="ltr">
        {part}
      </a>
    ) : (
      <Fragment key={`${key}-p${index}`}>{part}</Fragment>
    ),
  );
}

export function InlineRich({ text, keyPrefix = "i" }: { text: string; keyPrefix?: string }) {
  const lines = text.split(/<br\s*\/?>/i);
  if (lines.length > 1) {
    return (
      <>
        {lines.map((line, index) => (
          <Fragment key={`${keyPrefix}-br${index}`}>
            {index ? <br /> : null}
            <InlineRich text={line} keyPrefix={`${keyPrefix}-br${index}`} />
          </Fragment>
        ))}
      </>
    );
  }
  const parts = text.split(MATH_RE);
  return (
    <>
      {parts.map((part, index) => {
        const math = unwrap(part);
        if (math) return <Katex key={`${keyPrefix}-m${index}`} tex={math.tex.trim()} display={math.display} />;
        return <Fragment key={`${keyPrefix}-x${index}`}>{renderPlain(part, `${keyPrefix}-x${index}`)}</Fragment>;
      })}
    </>
  );
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

/** Joins lines that belong to one multi-line display-math island. */
function joinMath(lines: string[]): string[] {
  const out: string[] = [];
  let buffer: string[] | null = null;
  for (const line of lines) {
    if (buffer) {
      buffer.push(line);
      if (line.includes("\\]") || line.includes("$$")) {
        out.push(buffer.join(" "));
        buffer = null;
      }
      continue;
    }
    const opensBracket = line.includes("\\[") && !line.includes("\\]");
    const opensDollar = (line.match(/\$\$/g) ?? []).length === 1;
    if (opensBracket || opensDollar) buffer = [line];
    else out.push(line);
  }
  if (buffer) out.push(buffer.join(" "));
  return out;
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  // Keep fenced code untouched, join math elsewhere.
  let inCode = false;
  let code: string[] = [];
  const flushCode = () => {
    blocks.push({ kind: "code", text: code.join("\n") });
    code = [];
  };
  const prose: string[] = [];
  const flushProse = () => {
    lines.push(...joinMath(prose.splice(0)));
    for (const line of lines.splice(0)) pushLine(line);
  };
  const pushLine = (line: string) => {
    const trimmed = line.trim();
    const last = blocks[blocks.length - 1];
    if (!trimmed) return;
    if (/^\|.*\|$/.test(trimmed)) {
      const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return;
      if (last?.kind === "table") last.rows.push(cells);
      else blocks.push({ kind: "table", rows: [cells] });
      return;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return void blocks.push({ kind: "hr" });
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (heading) return void blocks.push({ kind: "h", text: heading[1] });
    const bullet = trimmed.match(/^(?:[-•*])\s+(.*)$/);
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
      return;
    }
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]] });
      return;
    }
    blocks.push({ kind: "p", text: trimmed });
  };
  for (const line of raw) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushProse();
        inCode = true;
      }
      continue;
    }
    if (inCode) code.push(line);
    else prose.push(line);
  }
  if (inCode) flushCode();
  flushProse();
  return blocks;
}

export function RichText({ text }: { text: string }) {
  const blocks = toBlocks(text);
  return (
    <div className="team-rich" dir="auto">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.kind === "hr") return <hr key={key} className="team-rich-hr" />;
        if (block.kind === "h") {
          return (
            <p key={key} className="team-rich-h">
              <InlineRich text={block.text} keyPrefix={key} />
            </p>
          );
        }
        if (block.kind === "p") {
          return (
            <p key={key}>
              <InlineRich text={block.text} keyPrefix={key} />
            </p>
          );
        }
        if (block.kind === "code") {
          return (
            <pre key={key} className="team-rich-code" dir="ltr">
              {block.text}
            </pre>
          );
        }
        if (block.kind === "table") {
          const [head, ...body] = block.rows;
          return (
            <div key={key} className="team-rich-table-wrap">
              <table className="team-rich-table">
                <thead>
                  <tr>
                    {head.map((cell, c) => (
                      <th key={`${key}-h${c}`}>
                        <InlineRich text={cell} keyPrefix={`${key}-h${c}`} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={`${key}-r${r}`}>
                      {row.map((cell, c) => (
                        <td key={`${key}-r${r}c${c}`}>
                          <InlineRich text={cell} keyPrefix={`${key}-r${r}c${c}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={key}>
            {block.items.map((item, i) => (
              <li key={`${key}-${i}`}>
                <InlineRich text={item} keyPrefix={`${key}-${i}`} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
