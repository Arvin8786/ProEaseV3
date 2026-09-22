import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib) {
  try {
    const fullUrl = pdfWorkerUrl.startsWith('http') 
      ? pdfWorkerUrl 
      : `${window.location.origin}${pdfWorkerUrl}`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = fullUrl;
  } catch (e) {
    console.warn("PDF worker initialization warning:", e);
  }
}

export { pdfjsLib, pdfWorkerUrl };
