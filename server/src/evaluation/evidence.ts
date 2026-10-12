import type { EvidenceQuote } from "../domain/feedback.js";

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'‘’`]/g, "")
    .replace(/[→]/g, "->")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks that a quote the reviewer attributed to the learner actually appears
 * in the submission. Quotes elided with "..." must match piece by piece, in order.
 */
export class EvidenceVerifier {
  private readonly haystack: string;

  constructor(rendered: string) {
    this.haystack = normalise(rendered);
  }

  verify(quote: string): boolean {
    const parts = quote
      .split(/\.{3}|…/)
      .map(normalise)
      .map((p) => p.replace(/^[.,;:\s]+|[.,;:\s]+$/g, ""))
      .filter((p) => p.length > 0);
    if (parts.length === 0) return false;

    let from = 0;
    for (const part of parts) {
      const at = this.haystack.indexOf(part, from);
      if (at === -1) return false;
      from = at + part.length;
    }
    return true;
  }

  verifyAll(quotes: EvidenceQuote[]): EvidenceQuote[] {
    return quotes.map((q) => ({ text: q.text, verified: this.verify(q.text) }));
  }
}
