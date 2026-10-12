/**
 * Find-in-document for the PDF viewer. Each page's text items (one per span in
 * pdf.js's text layer) are joined into one searchable string, so a match can
 * run across items and lines; `itemRanges` maps a match back to the spans to
 * highlight.
 */

export interface PageText {
  /** Each text item's original string, in text-layer order. */
  items: string[];
  /** Where each item starts in `text`. */
  starts: number[];
  /** Items joined (a space after each line end), lower-cased for matching. */
  text: string;
}

export interface PdfMatch {
  /** 1-based page number. */
  page: number;
  start: number;
  end: number;
}

// Lower-case without changing the string's length (a few characters, like
// "İ", lower-case to two), so offsets in `text` still line up with the items.
const foldChar = (c: string) => {
  const lower = c.toLowerCase();
  return lower.length === c.length ? lower : c;
};
const fold = (s: string) => Array.from(s, foldChar).join('');

export function buildPageText(items: { str: string; hasEOL?: boolean }[]): PageText {
  const strs: string[] = [];
  const starts: number[] = [];
  let text = '';
  for (const item of items) {
    strs.push(item.str);
    starts.push(text.length);
    text += fold(item.str);
    if (item.hasEOL && !/\s$/.test(item.str)) text += ' ';
  }
  return { items: strs, starts, text };
}

/** A block of plain text (a scan's OCR output) as one searchable item. Every
 *  whitespace character, line breaks included, matches a space, one for one,
 *  so offsets still point into the original text. */
export function buildPlainText(text: string): PageText {
  return { items: [text], starts: [0], text: fold(text.replace(/\s/g, ' ')) };
}

/** Every non-overlapping, case-insensitive occurrence of `query`, in reading order. */
export function findMatches(pages: (PageText | undefined)[], query: string): PdfMatch[] {
  const needle = fold(query.trim().replace(/\s+/g, ' '));
  if (!needle) return [];
  const matches: PdfMatch[] = [];
  pages.forEach((page, i) => {
    if (!page) return;
    let from = 0;
    for (;;) {
      const at = page.text.indexOf(needle, from);
      if (at === -1) break;
      matches.push({ page: i + 1, start: at, end: at + needle.length });
      from = at + needle.length;
    }
  });
  return matches;
}

/** The part of each text item a match covers, as offsets into that item. */
export function itemRanges(
  page: PageText,
  start: number,
  end: number,
): { item: number; from: number; to: number }[] {
  const out: { item: number; from: number; to: number }[] = [];
  page.items.forEach((str, i) => {
    const itemStart = page.starts[i];
    const from = Math.max(start, itemStart) - itemStart;
    const to = Math.min(end, itemStart + str.length) - itemStart;
    if (to > from) out.push({ item: i, from, to });
  });
  return out;
}
