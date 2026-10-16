import { Fragment, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Safe plain-text renderer for user content (descriptions, comments,
 * requests). No HTML is ever interpreted: React escapes all text, and only
 * http(s) URLs become links (rel=noopener noreferrer nofollow, new tab).
 * Supports paragraphs, line breaks and "- " bullet lists.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/g;

export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function linkify(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?]+$/, "");
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (isSafeHttpUrl(url)) {
      out.push(
        <a
          key={`${keyPrefix}-${start}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all text-accent underline decoration-accent/40 hover:decoration-accent"
        >
          {url}
        </a>,
      );
    } else {
      out.push(url);
    }
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={cn("flex flex-col gap-2 text-body text-fg [overflow-wrap:anywhere]", className)}>
      {blocks.flatMap((block, bi) => {
        // Split each block into runs of bullet lines and runs of plain lines.
        const runs: { list: boolean; lines: string[] }[] = [];
        for (const line of block.split("\n")) {
          const list = /^\s*[-*]\s+/.test(line);
          const last = runs.at(-1);
          if (last && last.list === list) last.lines.push(line);
          else runs.push({ list, lines: [line] });
        }
        return runs.map((run, ri) =>
          run.list ? (
            <ul key={`${bi}-${ri}`} className="ml-4 list-disc space-y-0.5 marker:text-fg-3">
              {run.lines.map((l, li) => (
                <li key={li}>{linkify(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${ri}-${li}`)}</li>
              ))}
            </ul>
          ) : (
            <p key={`${bi}-${ri}`}>
              {run.lines.map((l, li) => (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  {linkify(l, `${bi}-${ri}-${li}`)}
                </Fragment>
              ))}
            </p>
          ),
        );
      })}
    </div>
  );
}
