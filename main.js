const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { convertFile } = require('./src');

let mainWindow;

const iconPath = path.join(__dirname, 'assets', 'icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 680,
    minHeight: 520,
    title: 'DocToText',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  // Packaged builds use assets/icon.icns automatically; this sets the Dock icon
  // when running unpackaged via `npm start`, since macOS ignores BrowserWindow's icon.
  if (!app.isPackaged && app.dock) {
    app.dock.setIcon(iconPath);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Let the user pick a file via the native Open dialog.
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Supported documents', extensions: ['pdf', 'doc', 'docx', 'pptx', 'png', 'jpg', 'jpeg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Run the actual conversion, streaming progress back to the renderer as it works.
ipcMain.handle('convert-file', async (event, filePath) => {
  try {
    const result = await convertFile(filePath, (current, total, message) => {
      event.sender.send('conversion-progress', { current, total, message });
    });
    return { ok: true, text: result.text, warnings: result.warnings || [] };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
});

// Save the extracted text as a .md file straight into ~/Downloads.
ipcMain.handle('save-markdown', async (event, { suggestedName, content }) => {
  const downloadsDir = app.getPath('downloads');
  let fileName = suggestedName && suggestedName.trim() ? suggestedName.trim() : 'converted';
  fileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
  if (!fileName.toLowerCase().endsWith('.md')) fileName += '.md';

  const base = fileName.replace(/\.md$/i, '');
  let destPath = path.join(downloadsDir, fileName);
  let counter = 1;
  while (fs.existsSync(destPath)) {
    destPath = path.join(downloadsDir, `${base} (${counter}).md`);
    counter += 1;
  }

  fs.writeFileSync(destPath, content, 'utf8');
  return { ok: true, path: destPath };
});
