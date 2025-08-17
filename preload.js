const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  loadFolder: (dir, root) => ipcRenderer.invoke('load-folder', dir, root),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getAppVersion: () => ipcRenderer.invoke('get-version'),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  downloadDependency: (which) => ipcRenderer.invoke('download-dependency', which),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  onThemeChanged: (cb) => ipcRenderer.on('theme-changed', (e, t) => cb(t)),
  onTreeStart: (cb) => ipcRenderer.on('tree-start', (e, data) => cb(data)),
  onTreeNode: (cb) => ipcRenderer.on('tree-node', (e, data) => cb(data)),
  onTreeEnd: (cb) => ipcRenderer.on('tree-end', (e, parent) => cb(parent)),
  onLoadProgress: (cb) => ipcRenderer.on('load-progress', (e, data) => cb(data)),
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  startParse: (data) => ipcRenderer.invoke('start-parse', data),
  onParseProgress: (cb) => ipcRenderer.on('parse-progress', (e, msg) => cb(msg)),
  onParseStep: (cb) => ipcRenderer.on('parse-step', (e, data) => cb(data)),
  onParseComplete: (cb) => ipcRenderer.on('parse-complete', (e, success) => cb(success)),
  openParsedFolder: () => ipcRenderer.invoke('open-parsed-folder'),
  cancelParse: () => ipcRenderer.send('cancel-parse')
});
