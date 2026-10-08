const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  convertFile: (filePath) => ipcRenderer.invoke('convert-file', filePath),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('conversion-progress', listener);
    return () => ipcRenderer.removeListener('conversion-progress', listener);
  },
  saveMarkdown: (suggestedName, content) => ipcRenderer.invoke('save-markdown', { suggestedName, content }),
  copyToClipboard: (text) => clipboard.writeText(text),
});
