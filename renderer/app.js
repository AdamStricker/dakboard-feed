let currentItems = []
let sortable = null
let editingItemId = null

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer')
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

function showError(message) {
  document.querySelector('header').style.display = 'flex'
  document.querySelector('.toolbar').style.display = 'none'
  document.querySelector('main').innerHTML = `
    <div class="error-state">
      <h2>Could not load feed</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `
}

function renderList() {
  const list = document.getElementById('feedList')

  if (sortable) {
    sortable.destroy()
    sortable = null
  }

  list.innerHTML = ''
  currentItems.forEach(item => {
    const row = document.createElement('div')
    row.className = 'item-row'
    row.dataset.id = item.id
    row.innerHTML = `
      <span class="drag-handle">⠿</span>
      <div class="item-content">
        <div class="item-quote">${escapeHtml(item.title)}</div>
        <div class="item-source">${escapeHtml(item.bookTitle)} by ${escapeHtml(item.author)}</div>
      </div>
    `
    list.appendChild(row)
  })

  document.getElementById('itemCount').textContent =
    `${currentItems.length} item${currentItems.length === 1 ? '' : 's'}`

  sortable = Sortable.create(list, {
    handle: '.drag-handle',
    animation: 150,
    dragClass: 'sortable-drag',
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const idMap = Object.fromEntries(currentItems.map(item => [item.id, item]))
      const newOrder = Array.from(list.children).map(el => idMap[el.dataset.id]).filter(Boolean)
      currentItems = newOrder
      try {
        await window.api.saveItems(currentItems)
      } catch (err) {
        showToast(err.message, 'error')
      }
    }
  })
}

async function loadItems() {
  try {
    currentItems = await window.api.getItems()
    renderList()
  } catch (err) {
    showError(err.message)
  }
}

// ── Context Menu ──
const contextMenu = document.getElementById('contextMenu')
let contextTargetId = null

function hideContextMenu() {
  contextMenu.classList.add('hidden')
  contextTargetId = null
}

document.getElementById('feedList').addEventListener('contextmenu', e => {
  const row = e.target.closest('.item-row')
  if (!row) return
  e.preventDefault()
  contextTargetId = row.dataset.id

  // Position near cursor, keeping it on-screen
  const menuW = 140, menuH = 44
  const x = Math.min(e.clientX, window.innerWidth - menuW - 8)
  const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
  contextMenu.style.left = `${x}px`
  contextMenu.style.top = `${y}px`
  contextMenu.classList.remove('hidden')
})

document.addEventListener('click', e => {
  if (!contextMenu.contains(e.target)) hideContextMenu()
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') hideContextMenu()
})

document.getElementById('contextEdit').addEventListener('click', () => {
  const item = currentItems.find(i => i.id === contextTargetId)
  hideContextMenu()
  if (item) openModal(item)
})

document.getElementById('contextDelete').addEventListener('click', async () => {
  const id = contextTargetId
  hideContextMenu()
  currentItems = currentItems.filter(i => i.id !== id)
  renderList()
  try {
    await window.api.saveItems(currentItems)
    showToast('Item deleted')
  } catch (err) {
    showToast(err.message, 'error')
  }
})

// ── Add / Edit Modal ──
const modal = document.getElementById('modal')
const modalTitle = modal.querySelector('h2')
const quoteInput = document.getElementById('quoteInput')
const bookTitleInput = document.getElementById('bookTitleInput')
const authorInput = document.getElementById('authorInput')
const saveBtn = document.getElementById('saveBtn')

function validateModal() {
  saveBtn.disabled =
    !quoteInput.value.trim() ||
    !bookTitleInput.value.trim() ||
    !authorInput.value.trim()
}

;[quoteInput, bookTitleInput, authorInput].forEach(el =>
  el.addEventListener('input', validateModal)
)

function openModal(item = null) {
  editingItemId = item ? item.id : null
  modalTitle.textContent = item ? 'Edit Item' : 'Add Item'
  quoteInput.value = item ? item.title : ''
  bookTitleInput.value = item ? item.bookTitle : ''
  authorInput.value = item ? item.author : ''
  validateModal()
  modal.classList.remove('hidden')
  quoteInput.focus()
}

function closeModal() {
  modal.classList.add('hidden')
  editingItemId = null
}

document.getElementById('addBtn').addEventListener('click', () => openModal())

document.getElementById('cancelBtn').addEventListener('click', closeModal)

modal.addEventListener('click', e => {
  if (e.target === modal) closeModal()
})

saveBtn.addEventListener('click', async () => {
  const title = quoteInput.value.trim()
  const bookTitle = bookTitleInput.value.trim()
  const author = authorInput.value.trim()
  closeModal()

  if (editingItemId !== null) {
    // Edit in-place
    const idx = currentItems.findIndex(i => i.id === editingItemId)
    if (idx !== -1) {
      currentItems[idx] = {
        ...currentItems[idx],
        title,
        bookTitle,
        author,
        description: `"${bookTitle}" by ${author}`
      }
    }
    editingItemId = null
    try {
      await window.api.saveItems(currentItems)
      renderList()
      showToast('Item updated')
    } catch (err) {
      showToast(err.message, 'error')
    }
  } else {
    // Add new
    try {
      currentItems = await window.api.addItem({ title, bookTitle, author })
      renderList()
      showToast('Item added')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }
})

// ── Shuffle ──
document.getElementById('shuffleBtn').addEventListener('click', async () => {
  for (let i = currentItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [currentItems[i], currentItems[j]] = [currentItems[j], currentItems[i]]
  }
  renderList()
  try {
    await window.api.saveItems(currentItems)
  } catch (err) {
    showToast(err.message, 'error')
  }
})

// ── Push Live ──
document.getElementById('pushBtn').addEventListener('click', async () => {
  const btn = document.getElementById('pushBtn')
  btn.textContent = 'Pushing…'
  btn.disabled = true
  try {
    const result = await window.api.pushToGit()
    if (result.success) {
      showToast('Pushed to Git ✓', 'success')
    } else {
      showToast(result.error || 'Push failed', 'error')
    }
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    btn.textContent = 'Push Live'
    btn.disabled = false
  }
})

document.addEventListener('DOMContentLoaded', loadItems)
