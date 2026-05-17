const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const Parser = require('rss-parser')

const FEED_PATH = path.join(__dirname, 'quoteFeed.rss')

function parseDescription(desc) {
  if (!desc) return { bookTitle: '', author: '' }
  const match = desc.match(/^"(.+?)"\s+by\s+(.+)$/)
  if (match) return { bookTitle: match[1], author: match[2] }
  const idx = desc.indexOf(' by ')
  if (idx !== -1) {
    return {
      bookTitle: desc.slice(0, idx).replace(/^"|"$/g, '').trim(),
      author: desc.slice(idx + 4).trim()
    }
  }
  return { bookTitle: desc.replace(/^"|"$/g, '').trim(), author: '' }
}

async function parseItems() {
  const parser = new Parser()
  const xml = fs.readFileSync(FEED_PATH, 'utf8')
  const feed = await parser.parseString(xml)
  return feed.items.map((item, i) => {
    const rawDesc = item.content || ''
    const { bookTitle, author } = parseDescription(rawDesc)
    const id = item.guid || `item-${i}`
    return {
      id,
      title: item.title || '',
      bookTitle,
      author,
      description: rawDesc,
      pubDate: item.pubDate || 'Wed, 01 Apr 2026 09:00:00 +0000',
      guid: id
    }
  })
}

function buildXml(items) {
  const itemsXml = items.map(item => {
    const desc = `"${item.bookTitle || ''}" by ${item.author || ''}`
    return `    <item>
      <title><![CDATA[${item.title || ''}]]></title>
      <description><![CDATA[${desc}]]></description>
      <pubDate>${item.pubDate || 'Wed, 01 Apr 2026 09:00:00 +0000'}</pubDate>
      <guid>${item.guid || item.id || ''}</guid>
    </item>`
  }).join('\n\n')

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>My Feed</title>
    <link>https://example.com</link>
    <description>My custom DAKboard feed</description>

${itemsXml}
  </channel>
</rss>`
}

function writeItems(items) {
  const xml = buildXml(items)
  const tmpPath = `${FEED_PATH}.tmp`
  fs.writeFileSync(tmpPath, xml, 'utf8')
  fs.renameSync(tmpPath, FEED_PATH)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
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

ipcMain.handle('items:get', async () => {
  if (!fs.existsSync(FEED_PATH)) {
    throw new Error(`Feed file not found: ${FEED_PATH}`)
  }
  return parseItems()
})

ipcMain.handle('items:save', async (_event, items) => {
  writeItems(items)
  return { success: true }
})

ipcMain.handle('items:add', async (_event, item) => {
  const items = await parseItems()
  const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const newItem = {
    id: newId,
    title: item.title || '',
    bookTitle: item.bookTitle || '',
    author: item.author || '',
    description: `"${item.bookTitle || ''}" by ${item.author || ''}`,
    pubDate: 'Wed, 01 Apr 2026 09:00:00 +0000',
    guid: newId
  }
  items.push(newItem)
  writeItems(items)
  return items
})

ipcMain.handle('git:push', () => {
  return new Promise((resolve) => {
    exec(
      'git add quoteFeed.rss && git commit -m "Update RSS feed" && git push',
      { cwd: __dirname },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message })
        } else {
          resolve({ success: true, output: stdout })
        }
      }
    )
  })
})
