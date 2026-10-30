const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('stickyAPI', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: notes => ipcRenderer.invoke('notes:save', notes),
  pickAttachment: () => ipcRenderer.invoke('attachment:pick'),
  savePastedImage: payload => ipcRenderer.invoke('attachment:save-pasted', payload),
  openAttachment: name => ipcRenderer.invoke('attachment:open', name),
  deleteAttachment: name => ipcRenderer.invoke('attachment:delete', name),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  currentStorage: () => ipcRenderer.invoke('storage:current'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: theme => ipcRenderer.invoke('theme:set', theme)
});