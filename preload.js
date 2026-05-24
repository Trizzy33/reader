const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openFile:     ()                    => ipcRenderer.invoke('open-file'),
  translate:    (text, from, to)      => ipcRenderer.invoke('translate', text, from, to),
  getWordbook:  ()                    => ipcRenderer.invoke('get-wordbook'),
  addWord:      (word, translation)   => ipcRenderer.invoke('add-word', word, translation),
  deleteWord:   (word)                => ipcRenderer.invoke('delete-word', word),
  getPosition:  (filePath)            => ipcRenderer.invoke('get-position', filePath),
  savePosition: (filePath, scrollTop) => ipcRenderer.invoke('save-position', filePath, scrollTop)
})
