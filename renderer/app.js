const SETTINGS_KEY = 'rdr_settings'
const DEFAULT = { fontSize: 18, theme: 'light', hoverOpacity: 95, hoverTextSize: 14, langFrom: 'en', langTo: 'zh' }

let currentFile = null
let wordbookData = {}
let wordbookOpen = false
let hoverVisible = false
let pendingWord = null
let scrollTimer = null

// DOM
const openBtn         = document.getElementById('open-btn')
const fileNameEl      = document.getElementById('file-name')
const fontDec         = document.getElementById('font-dec')
const fontInc         = document.getElementById('font-inc')
const themeToggle     = document.getElementById('theme-toggle')
const wordbookBtn     = document.getElementById('wordbook-btn')
const dropZone        = document.getElementById('drop-zone')
const readerWrap      = document.getElementById('reader-wrap')
const content         = document.getElementById('content')
const wordbookPanel   = document.getElementById('wordbook-panel')
const wordbookList    = document.getElementById('wordbook-list')
const wordCountEl     = document.getElementById('word-count')
const hoverBox        = document.getElementById('hover-box')
const hoverWordLabel  = document.getElementById('hover-word-label')
const hoverTransEl    = document.getElementById('hover-translation')
const hoverSettingsBtn= document.getElementById('hover-settings-btn')
const hoverSettings   = document.getElementById('hover-settings')
const opacitySlider   = document.getElementById('opacity-slider')
const opacityVal      = document.getElementById('opacity-val')
const textSizeSlider  = document.getElementById('text-size-slider')
const textSizeVal     = document.getElementById('text-size-val')
const langFrom        = document.getElementById('lang-from')
const langTo          = document.getElementById('lang-to')

// ── Settings ─────────────────────────────────────────────────────────────────

function getSettings() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) } }
  catch { return { ...DEFAULT } }
}

function patchSettings(patch) {
  const s = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  return s
}

function applySettings(s) {
  document.documentElement.style.setProperty('--font-size', s.fontSize + 'px')
  document.documentElement.style.setProperty('--hover-text-size', s.hoverTextSize + 'px')
  document.body.classList.toggle('dark', s.theme === 'dark')
  themeToggle.textContent = s.theme === 'dark' ? '☀' : '☾'
  hoverBox.style.opacity = s.hoverOpacity / 100
  opacitySlider.value  = s.hoverOpacity
  opacityVal.textContent = s.hoverOpacity + '%'
  textSizeSlider.value = s.hoverTextSize
  textSizeVal.textContent = s.hoverTextSize + 'px'
  langFrom.value = s.langFrom
  langTo.value   = s.langTo
}

// ── File open ─────────────────────────────────────────────────────────────────

async function openFile() {
  const result = await window.api.openFile()
  if (!result || result.error) return
  await loadFile(result.path, result.name, result.content)
}

async function loadFile(filePath, name, text) {
  currentFile = filePath
  content.textContent = text
  fileNameEl.textContent = name
  document.title = name + ' — Reader'
  dropZone.hidden = true
  readerWrap.hidden = false
  hideHover()

  const pos = await window.api.getPosition(filePath)
  readerWrap.scrollTop = pos
}

// ── Translation hover ──────────────────────────────────────────────────────────

function placeHoverBox(selRect) {
  const margin = 10
  const bw = hoverBox.offsetWidth || 288
  let left = selRect.left + selRect.width / 2 - bw / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - bw - margin))

  let top = selRect.bottom + margin
  if (top + 160 > window.innerHeight) top = Math.max(margin, selRect.top - 160 - margin)

  hoverBox.style.left = left + 'px'
  hoverBox.style.top  = top  + 'px'
}

async function showHover(word, selRect) {
  pendingWord = word
  hoverVisible = true
  hoverWordLabel.textContent = word.length > 40 ? word.slice(0, 40) + '…' : word
  hoverTransEl.textContent = '…'
  hoverBox.hidden = false
  placeHoverBox(selRect)

  const s = getSettings()
  const result = await window.api.translate(word, s.langFrom, s.langTo)

  if (!hoverVisible || pendingWord !== word) return

  if (result.ok) {
    hoverTransEl.textContent = result.text
    wordbookData = await window.api.addWord(word, result.text)
    renderWordbook()
  } else {
    hoverTransEl.textContent = '— ' + result.text
  }
}

function hideHover() {
  hoverVisible = false
  hoverBox.hidden = true
  hoverSettings.hidden = true
}

// ── Wordbook ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderWordbook() {
  const entries = Object.entries(wordbookData)
    .sort((a, b) => b[1].count - a[1].count)

  wordCountEl.textContent = entries.length

  wordbookList.innerHTML = entries.map(([word, data]) => `
    <div class="wb-row">
      <div class="wb-main">
        <span class="wb-word">${esc(word)}</span>
        <span class="wb-meta">
          <span class="wb-count">${data.count}×</span>
          <button class="wb-del" data-word="${esc(word)}" title="Remove">×</button>
        </span>
      </div>
      <div class="wb-trans">${esc(data.translation)}</div>
    </div>
  `).join('')
}

// ── Event wiring ──────────────────────────────────────────────────────────────

openBtn.addEventListener('click', openFile)

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); openFile() }
  if (e.key === 'Escape') hideHover()
  if (e.key === 'w' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
    wordbookBtn.click()
  }
})

fontDec.addEventListener('click', () => applySettings(patchSettings({ fontSize: Math.max(10, getSettings().fontSize - 2) })))
fontInc.addEventListener('click', () => applySettings(patchSettings({ fontSize: Math.min(40, getSettings().fontSize + 2) })))
themeToggle.addEventListener('click', () => {
  const s = getSettings()
  applySettings(patchSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' }))
})

wordbookBtn.addEventListener('click', () => {
  wordbookOpen = !wordbookOpen
  wordbookPanel.hidden = !wordbookOpen
  wordbookBtn.classList.toggle('active', wordbookOpen)
})

wordbookList.addEventListener('click', async e => {
  const btn = e.target.closest('.wb-del')
  if (!btn) return
  wordbookData = await window.api.deleteWord(btn.dataset.word)
  renderWordbook()
})

// Text selection → translate on mouse release
document.addEventListener('mouseup', e => {
  if (hoverBox.contains(e.target)) return

  const sel = window.getSelection()
  const word = sel ? sel.toString().trim() : ''

  if (!word || word.length < 2 || !currentFile) {
    if (!hoverBox.contains(e.target)) hideHover()
    return
  }

  try {
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    showHover(word, rect)
  } catch { /* ignore selection edge cases */ }
})

// Hide hover on click outside
document.addEventListener('mousedown', e => {
  if (!hoverBox.contains(e.target)) hideHover()
})

// Hover box settings toggle
hoverSettingsBtn.addEventListener('click', e => {
  e.stopPropagation()
  hoverSettings.hidden = !hoverSettings.hidden
})

opacitySlider.addEventListener('input', () => {
  const val = parseInt(opacitySlider.value)
  opacityVal.textContent = val + '%'
  hoverBox.style.opacity = val / 100
  patchSettings({ hoverOpacity: val })
})

textSizeSlider.addEventListener('input', () => {
  const val = parseInt(textSizeSlider.value)
  textSizeVal.textContent = val + 'px'
  document.documentElement.style.setProperty('--hover-text-size', val + 'px')
  patchSettings({ hoverTextSize: val })
})

langFrom.addEventListener('change', () => patchSettings({ langFrom: langFrom.value.trim() || 'en' }))
langTo.addEventListener('change',   () => patchSettings({ langTo:   langTo.value.trim()   || 'zh' }))

// Save scroll position (throttled 500ms)
readerWrap.addEventListener('scroll', () => {
  if (!currentFile) return
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => window.api.savePosition(currentFile, readerWrap.scrollTop), 500)
})

// Drag and drop
document.addEventListener('dragover', e => {
  e.preventDefault()
  if (!currentFile) dropZone.classList.add('drag-over')
})
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) dropZone.classList.remove('drag-over')
})
document.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.classList.remove('drag-over')
  const file = e.dataTransfer.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => loadFile(file.path, file.name, reader.result)
  reader.readAsText(file)
})

// ── Init ──────────────────────────────────────────────────────────────────────

;(async () => {
  applySettings(getSettings())
  wordbookData = await window.api.getWordbook()
  renderWordbook()
})()
