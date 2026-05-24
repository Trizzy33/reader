const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs')
const path = require('path')

function dataPath(file) {
  return path.join(app.getPath('userData'), file)
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(dataPath(file), 'utf-8')) }
  catch { return {} }
}

function writeJson(file, data) {
  fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1050, height: 720,
    minWidth: 520, minHeight: 420,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.once('ready-to-show', () => win.show())
  win.webContents.openDevTools({ mode: 'detach' })
  win.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i')
      win.webContents.toggleDevTools()
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'md', 'log', 'rtf', 'rtt', 'csv', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (canceled || !filePaths.length) return null
  const filePath = filePaths[0]
  try {
    return { path: filePath, name: path.basename(filePath), content: fs.readFileSync(filePath, 'utf-8') }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('translate', async (_, text, from, to) => {
  try {
    const langpair = `${from === 'auto' ? 'autodetect' : from}|${to}`
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${langpair}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.responseStatus === 200) return { ok: true, text: data.responseData.translatedText }
    return { ok: false, text: data.responseDetails || 'Translation failed' }
  } catch (err) {
    return { ok: false, text: err.message }
  }
})

ipcMain.handle('get-wordbook', () => readJson('wordbook.json'))

ipcMain.handle('add-word', (_, word, translation) => {
  const wb = readJson('wordbook.json')
  const entry = wb[word] || { translation, count: 0, added: Date.now() }
  entry.translation = translation
  entry.count++
  entry.lastSeen = Date.now()
  wb[word] = entry
  writeJson('wordbook.json', wb)
  return wb
})

ipcMain.handle('delete-word', (_, word) => {
  const wb = readJson('wordbook.json')
  delete wb[word]
  writeJson('wordbook.json', wb)
  return wb
})

ipcMain.handle('get-position', (_, filePath) => {
  return readJson('positions.json')[filePath] || 0
})

ipcMain.handle('save-position', (_, filePath, scrollTop) => {
  const pos = readJson('positions.json')
  pos[filePath] = scrollTop
  writeJson('positions.json', pos)
})
