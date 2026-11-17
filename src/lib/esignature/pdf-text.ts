/**
 * The signed PDFs use pdf-lib's standard Helvetica, which only encodes WinAnsi (Western European) characters, and
 * `drawText` throws on anything else — which would make a customer typing "Łukasz" or "Nguyễn" unable to sign.
 * Accents are folded to their base letter where possible; anything still unsupported becomes "?".
 */
export function pdfSafe(text: string): string {
  const folded = text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
  let out = "";
  for (const char of folded) {
    const code = char.codePointAt(0) ?? 0;
    // WinAnsi covers printable ASCII, Latin-1 and a few typographic marks (curly quotes, dashes, bullet, euro...).
    out += (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || "‘’“”–—•€…".includes(char) ? char : "?";
  }
  return out;
}
