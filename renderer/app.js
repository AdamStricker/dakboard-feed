let currentItems = []
let sortable = null

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

// ── Add Item Modal ──
const modal = document.getElementById('modal')
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

document.getElementById('addBtn').addEventListener('click', () => {
  quoteInput.value = ''
  bookTitleInput.value = ''
  authorInput.value = ''
  saveBtn.disabled = true
  modal.classList.remove('hidden')
  quoteInput.focus()
})

document.getElementById('cancelBtn').addEventListener('click', () => {
  modal.classList.add('hidden')
})

modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.add('hidden')
})

saveBtn.addEventListener('click', async () => {
  const item = {
    title: quoteInput.value.trim(),
    bookTitle: bookTitleInput.value.trim(),
    author: authorInput.value.trim()
  }
  modal.classList.add('hidden')
  try {
    currentItems = await window.api.addItem(item)
    renderList()
    showToast('Item added')
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
