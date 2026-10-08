const WordExtractor = require('word-extractor');

// Legacy binary .doc format — mammoth can't read this, so we use word-extractor instead.
async function convertDoc(filePath, onProgress) {
  onProgress(0, 1, 'Reading legacy Word document...');
  const extractor = new WordExtractor();
  const doc = await extractor.extract(filePath);

  const parts = [doc.getBody() || ''];

  try {
    const footnotes = doc.getFootnotes();
    if (footnotes && footnotes.trim()) parts.push(`\n\n---\n\n**Footnotes**\n\n${footnotes}`);
  } catch {
    // Not every .doc has footnotes; ignore if unavailable.
  }
  try {
    const endnotes = doc.getEndnotes();
    if (endnotes && endnotes.trim()) parts.push(`\n\n---\n\n**Endnotes**\n\n${endnotes}`);
  } catch {
    // Not every .doc has endnotes; ignore if unavailable.
  }

  onProgress(1, 1, 'Done');
  return { text: parts.join('\n'), warnings: [] };
}

module.exports = { convertDoc };
