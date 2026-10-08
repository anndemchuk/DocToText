const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

// Language data lives locally in assets/tessdata so recognition never touches the network.
// See README.md for the one-time download command that populates this folder.
const LANG_PATH = path.join(__dirname, '..', '..', 'assets', 'tessdata');

function getElectronApp() {
  try {
    // Only available when running inside Electron's main process.
    return require('electron').app;
  } catch {
    return null;
  }
}

function ensureLanguageDataPresent() {
  const gzPath = path.join(LANG_PATH, 'eng.traineddata.gz');
  const plainPath = path.join(LANG_PATH, 'eng.traineddata');
  if (fs.existsSync(gzPath) || fs.existsSync(plainPath)) {
    return { gzip: fs.existsSync(gzPath) };
  }
  throw new Error(
    'OCR language data not found. Run this once in Terminal to download it ' +
      '(about 4 MB, official Tesseract project data, one-time only — after this, OCR runs fully offline):\n\n' +
      `mkdir -p "${LANG_PATH}" && curl -L -o "${gzPath}" ` +
      'https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz\n\n' +
      'Then try converting the image again.'
  );
}

// Runs fully offline: Tesseract does the recognition locally, and the worker/core files
// ship inside node_modules, so nothing about the image or its text is sent anywhere.
async function convertImage(filePath, onProgress) {
  onProgress(0, 1, 'Loading OCR engine...');
  const { gzip } = ensureLanguageDataPresent();

  const app = getElectronApp();
  const cachePath = app ? path.join(app.getPath('userData'), 'tessdata-cache') : LANG_PATH;
  if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath, { recursive: true });

  const worker = await createWorker('eng', 1, {
    langPath: LANG_PATH,
    cachePath,
    gzip,
  });

  try {
    onProgress(0, 1, 'Recognizing text in image...');
    const { data } = await worker.recognize(filePath);
    onProgress(1, 1, 'Done');
    return { text: data.text || '', warnings: [] };
  } finally {
    await worker.terminate();
  }
}

module.exports = { convertImage };
