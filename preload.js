const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getItems: () => ipcRenderer.invoke('items:get'),
  saveItems: (items) => ipcRenderer.invoke('items:save', items),
  addItem: (item) => ipcRenderer.invoke('items:add', item),
  pushToGit: () => ipcRenderer.invoke('git:push'),
})
