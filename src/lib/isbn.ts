/**
 * ISBN lookup via OpenLibrary API.
 * No API key required.
 */

export interface BookInfo {
  title: string;
  author: string;
  description: string;
  isbn: string;
}

export const lookupISBN = async (isbn: string): Promise<BookInfo | null> => {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    if (!res.ok) return null;

    const json = await res.json();
    const book = json[`ISBN:${isbn}`];
    if (!book) return null;

    const title: string = book.title ?? '';
    const author: string = book.authors?.[0]?.name ?? '';
    const description: string =
      typeof book.notes === 'string'
        ? book.notes
        : book.excerpts?.[0]?.text ?? '';

    return { title, author, description, isbn };
  } catch (err) {
    console.warn('[ISBN] Lookup failed:', err);
    return null;
  }
};

/**
 * Check if native BarcodeDetector API is available.
 * Works in Chrome/Edge on Android and Safari 17+.
 */
export const isBarcodeDetectorSupported = (): boolean =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window;
