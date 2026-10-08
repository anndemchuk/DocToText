const fs = require('fs');
const mammoth = require('mammoth');

// mammoth reads the whole .docx in one pass (Word documents don't expose page
// boundaries in the file format, so there's nothing to batch by "page" here).
async function convertDocx(filePath, onProgress) {
  onProgress(0, 1, 'Reading Word document...');
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  onProgress(1, 1, 'Done');
  return { text: result.value, warnings: (result.messages || []).map((m) => m.message) };
}

module.exports = { convertDocx };
