const fs = require('fs');

const PAGES_PER_BATCH = 10;

// Extracts text page-by-page in batches, so huge PDFs (hundreds/thousands of pages)
// don't need to be fully materialized in memory at once and the app stays responsive.
async function convertPdf(filePath, onProgress) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageTexts = new Array(totalPages);

  onProgress(0, totalPages, `Starting extraction of ${totalPages} page${totalPages === 1 ? '' : 's'}...`);

  for (let batchStart = 1; batchStart <= totalPages; batchStart += PAGES_PER_BATCH) {
    const batchEnd = Math.min(batchStart + PAGES_PER_BATCH - 1, totalPages);

    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      pageTexts[pageNum - 1] = content.items.map((item) => item.str).join(' ');
      page.cleanup();
    }

    onProgress(batchEnd, totalPages, `Extracted page ${batchEnd} of ${totalPages}`);
    // Yield to the event loop between batches so IPC/UI stays responsive on huge files.
    await new Promise((resolve) => setImmediate(resolve));
  }

  await pdf.destroy();

  const text = pageTexts.map((t, i) => `## Page ${i + 1}\n\n${t}`).join('\n\n');
  return { text, warnings: [] };
}

module.exports = { convertPdf };
