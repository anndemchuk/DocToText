const path = require('path');
const { convertPdf } = require('./converters/pdf');
const { convertDocx } = require('./converters/docx');
const { convertDoc } = require('./converters/doc');
const { convertPptx } = require('./converters/pptx');
const { convertImage } = require('./converters/image');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.png', '.jpg', '.jpeg'];

// Dispatches to the right converter based on file extension.
// Every converter returns { text, warnings } and reports progress via onProgress(current, total, message).
async function convertFile(filePath, onProgress) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return convertPdf(filePath, onProgress);
    case '.docx':
      return convertDocx(filePath, onProgress);
    case '.doc':
      return convertDoc(filePath, onProgress);
    case '.pptx':
      return convertPptx(filePath, onProgress);
    case '.png':
    case '.jpg':
    case '.jpeg':
      return convertImage(filePath, onProgress);
    default:
      throw new Error(
        `Unsupported file type "${ext || 'unknown'}". Supported types: PDF, DOC, DOCX, PPTX, PNG, JPG, JPEG.`
      );
  }
}

module.exports = { convertFile, SUPPORTED_EXTENSIONS };
