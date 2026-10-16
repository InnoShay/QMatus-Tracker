import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/ui/rich-text";

const html = (text: string) => renderToStaticMarkup(createElement(RichText, { text }));

describe("RichText (untrusted user content)", () => {
  it("never interprets HTML", () => {
    const out = html('<img src=x onerror="alert(1)"><script>alert(2)</script>');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;");
  });
  it("does not turn javascript: or data: URLs into links", () => {
    expect(html("javascript:alert(1)")).not.toContain("<a");
    expect(html("data:text/html,<b>x</b>")).not.toContain("<a");
  });
  it("links http(s) URLs safely and drops trailing punctuation", () => {
    const out = html("See https://example.com/docs.");
    expect(out).toContain('href="https://example.com/docs"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });
  it("renders bullet runs as lists even after a heading line", () => {
    const out = html("Acceptance criteria:\n- one\n- two");
    expect(out).toMatch(/<p>Acceptance criteria:<\/p><ul[^>]*><li>one<\/li><li>two<\/li><\/ul>/);
  });
});
