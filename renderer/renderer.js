const screens = {
  upload: document.getElementById('upload-screen'),
  processing: document.getElementById('processing-screen'),
  error: document.getElementById('error-screen'),
  result: document.getElementById('result-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove('active'));
  screens[name].classList.add('active');
}

const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');

const processingFilename = document.getElementById('processing-filename');
const progressBar = document.getElementById('progress-bar');
const processingStatus = document.getElementById('processing-status');

const errorMessage = document.getElementById('error-message');
const tryAgainBtn = document.getElementById('try-again-btn');

const resultFilename = document.getElementById('result-filename');
const resultText = document.getElementById('result-text');
const warningsNote = document.getElementById('warnings-note');
const copyBtn = document.getElementById('copy-btn');
const saveBtn = document.getElementById('save-btn');
const newFileBtn = document.getElementById('new-file-btn');
const toast = document.getElementById('toast');

let currentFilePath = null;
let currentFileName = null;
let stopProgressListener = null;

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.png', '.jpg', '.jpeg'];

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

function baseNameWithoutExt(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? name : name.slice(0, i);
}

async function startConversion(filePath) {
  if (!filePath) return;

  const fileName = filePath.split(/[\\/]/).pop();
  const ext = extOf(fileName);

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    showError(
      `"${fileName}" isn't a supported format.\n\nSupported types: PDF, DOC, DOCX, PPTX, PNG, JPG, JPEG.`
    );
    return;
  }

  currentFilePath = filePath;
  currentFileName = fileName;

  processingFilename.textContent = fileName;
  progressBar.style.width = '0%';
  progressBar.classList.add('indeterminate');
  processingStatus.textContent = 'Starting...';
  showScreen('processing');

  if (stopProgressListener) stopProgressListener();
  stopProgressListener = window.api.onProgress(({ current, total, message }) => {
    if (total > 0) {
      progressBar.classList.remove('indeterminate');
      progressBar.style.width = `${Math.min(100, Math.round((current / total) * 100))}%`;
    }
    if (message) processingStatus.textContent = message;
  });

  try {
    const result = await window.api.convertFile(filePath);
    if (stopProgressListener) {
      stopProgressListener();
      stopProgressListener = null;
    }

    if (!result.ok) {
      showError(result.error || 'Something went wrong while converting this file.');
      return;
    }

    showResult(fileName, result.text, result.warnings || []);
  } catch (err) {
    if (stopProgressListener) {
      stopProgressListener();
      stopProgressListener = null;
    }
    showError((err && err.message) || String(err));
  }
}

function showError(message) {
  errorMessage.textContent = message;
  showScreen('error');
}

function showResult(fileName, text, warnings) {
  resultFilename.textContent = fileName;
  resultText.value = text;
  if (warnings.length) {
    warningsNote.hidden = false;
    warningsNote.textContent = `Converted with ${warnings.length} note${warnings.length === 1 ? '' : 's'}: ${warnings.join('; ')}`;
  } else {
    warningsNote.hidden = true;
    warningsNote.textContent = '';
  }
  showScreen('result');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

// --- Upload interactions ---

browseBtn.addEventListener('click', async () => {
  const filePath = await window.api.selectFile();
  if (filePath) startConversion(filePath);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });
});

dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.path) {
    startConversion(file.path);
  }
});

// Prevent the window from navigating away if a file is dropped outside the drop zone.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// --- Error screen ---

tryAgainBtn.addEventListener('click', () => {
  currentFilePath = null;
  currentFileName = null;
  showScreen('upload');
});

// --- Result screen ---

copyBtn.addEventListener('click', () => {
  window.api.copyToClipboard(resultText.value);
  showToast('Copied to clipboard');
});

saveBtn.addEventListener('click', async () => {
  const suggestedName = `${baseNameWithoutExt(currentFileName || 'converted')}.md`;
  const result = await window.api.saveMarkdown(suggestedName, resultText.value);
  if (result && result.ok) {
    showToast(`Saved to Downloads: ${result.path.split(/[\\/]/).pop()}`);
  } else {
    showToast('Could not save the file');
  }
});

newFileBtn.addEventListener('click', () => {
  currentFilePath = null;
  currentFileName = null;
  showScreen('upload');
});
