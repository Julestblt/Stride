import { describe, expect, it } from "vitest";
import {
  markdownPlainText,
  parseInline,
  parseMarkdown,
} from "../../src/features/coach/markdown";

const plain = (text: string) => ({ text, bold: false, italic: false });

describe("coach markdown", () => {
  it("parses bold, italic and code spans without markers", () => {
    expect(parseInline("**Verdict :** reste *calme* avec `VFC`")).toEqual([
      { text: "Verdict :", bold: true, italic: false },
      plain(" reste "),
      { text: "calme", bold: false, italic: true },
      plain(" avec "),
      plain("VFC"),
    ]);
    expect(parseInline("2 * 3 * 4")).toEqual([plain("2 * 3 * 4")]);
  });

  it("splits paragraphs on blank lines and keeps line breaks", () => {
    expect(parseMarkdown("Salut\nJules\n\nDeuxième")).toEqual([
      { type: "paragraph", lines: [[plain("Salut")], [plain("Jules")]] },
      { type: "paragraph", lines: [[plain("Deuxième")]] },
    ]);
  });

  it("renders headings as their own line", () => {
    expect(parseMarkdown("## Plan de la semaine ##\nTexte")).toEqual([
      { type: "heading", spans: [plain("Plan de la semaine")] },
      { type: "paragraph", lines: [[plain("Texte")]] },
    ]);
  });

  it("parses unordered and ordered lists with one nesting level", () => {
    const [list, ordered] = parseMarkdown(
      "- Lundi\n  - repos\n  - étirements\n- Mardi\n\n1. Un\n2. Deux",
    );
    expect(list).toEqual({
      type: "list",
      ordered: false,
      items: [
        {
          spans: [plain("Lundi")],
          children: {
            ordered: false,
            items: [
              { spans: [plain("repos")], children: null },
              { spans: [plain("étirements")], children: null },
            ],
          },
        },
        { spans: [plain("Mardi")], children: null },
      ],
    });
    expect(ordered).toMatchObject({
      type: "list",
      ordered: true,
      items: [{ spans: [plain("Un")] }, { spans: [plain("Deux")] }],
    });
  });

  it("never keeps raw HTML as markup", () => {
    expect(markdownPlainText("<b>salut</b>")).toBe("<b>salut</b>");
  });

  it("strips markers for the list preview", () => {
    expect(
      markdownPlainText(
        "**Verdict :** prudence.\n\n- *descentes* limitées\n- 1. ok",
      ),
    ).toBe("Verdict : prudence. descentes limitées 1. ok");
  });
});
