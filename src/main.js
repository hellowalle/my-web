import './style.css'

const STORAGE_KEY = 'todos.v1'
const THEME_KEY = 'theme.v1'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="app" aria-label="待办事项应用">
    <header class="app__header">
      <div class="header-content">
        <span class="pill pill--header">今日</span>
        <h1>待办工作室</h1>
        <p class="subtitle">清晰规划，高效收尾。</p>
      </div>
    </header>

    <form class="add-form" aria-label="添加待办事项">
      <label class="sr-only" for="new-todo">添加待办事项</label>
      <input
        id="new-todo"
        name="new-todo"
        type="text"
        placeholder="添加事项并按回车"
        autocomplete="off"
      />
      <button class="btn btn-primary" type="submit">添加</button>
    </form>

    <section class="toolbar" aria-label="筛选与操作">
      <div class="filters" role="tablist" aria-label="筛选待办">
        <button class="filter-btn" type="button" data-filter="all" aria-pressed="true">全部</button>
        <button class="filter-btn" type="button" data-filter="active" aria-pressed="false">进行中</button>
        <button class="filter-btn" type="button" data-filter="completed" aria-pressed="false">已完成</button>
      </div>
      <div class="toolbar__right">
        <button class="btn btn-ghost theme-toggle" type="button" aria-pressed="false">深色模式</button>
        <button class="btn btn-ghost clear-completed" type="button">清除已完成</button>
      </div>
    </section>

    <section class="bulk-bar" aria-label="批量操作">
      <div class="bulk-info">
        <span class="selection-count"><strong data-selected-count>0</strong> 已选择</span>
      </div>
      <div class="bulk-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-bulk="select-all">全选</button>
        <button class="btn btn-ghost btn-sm" type="button" data-bulk="clear-selection">清除选择</button>
        <button class="btn btn-primary btn-sm" type="button" data-bulk="complete">标记完成</button>
        <button class="btn btn-danger btn-sm" type="button" data-bulk="delete">删除所选</button>
      </div>
    </section>

    <ul class="todo-list" aria-live="polite"></ul>
    <div class="sr-only" aria-live="polite" data-announcer></div>

    <footer class="app__footer">
      <span class="count"><strong data-count>0</strong> 项待完成</span>
      <span class="hint">提示：回车添加，回车保存，Esc 取消编辑。</span>
    </footer>
  </main>
`

const form = app.querySelector('.add-form')
const input = app.querySelector('#new-todo')
const list = app.querySelector('.todo-list')
const filterButtons = Array.from(app.querySelectorAll('[data-filter]'))
const clearButton = app.querySelector('.clear-completed')
const themeToggle = app.querySelector('.theme-toggle')
const bulkButtons = Array.from(app.querySelectorAll('[data-bulk]'))
const selectedCountEl = app.querySelector('[data-selected-count]')
const announcer = app.querySelector('[data-announcer]')
const countEl = app.querySelector('[data-count]')

let todos = loadTodos()
let currentFilter = 'all'
let editingId = null
let draggingId = null
const selectedIds = new Set()

const themePreference = localStorage.getItem(THEME_KEY)
const systemPrefersDark =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
let currentTheme = themePreference || (systemPrefersDark ? 'dark' : 'light')
applyTheme(currentTheme)

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => typeof item?.title === 'string')
      .map((item) => ({
        id: item.id || cryptoId(),
        title: item.title,
        completed: Boolean(item.completed),
      }))
  } catch (error) {
    console.error('Failed to load todos', error)
    return []
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
}

function applyTheme(theme) {
  currentTheme = theme
  document.documentElement.dataset.theme = theme
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'))
  themeToggle.textContent = theme === 'dark' ? '浅色模式' : '深色模式'
}

function announce(message) {
  if (!announcer) return
  announcer.textContent = ''
  requestAnimationFrame(() => {
    announcer.textContent = message
  })
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function addTodo(title) {
  const trimmed = title.trim()
  if (!trimmed) return
  todos = [{ id: cryptoId(), title: trimmed, completed: false }, ...todos]
  saveTodos()
  render()
}

function toggleTodo(id) {
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  )
  saveTodos()
  render()
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id)
  selectedIds.delete(id)
  if (editingId === id) editingId = null
  saveTodos()
  render()
}

function setFilter(filter) {
  currentFilter = filter
  render()
}

function startEdit(id) {
  editingId = id
  render()
}

function cancelEdit() {
  editingId = null
  render()
}

function saveEdit(id, title) {
  const trimmed = title.trim()
  if (!trimmed) {
    deleteTodo(id)
    return
  }
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, title: trimmed } : todo
  )
  editingId = null
  saveTodos()
  render()
}

function clearCompleted() {
  todos = todos.filter((todo) => {
    if (todo.completed) selectedIds.delete(todo.id)
    return !todo.completed
  })
  saveTodos()
  render()
}

function filteredTodos() {
  if (currentFilter === 'active') {
    return todos.filter((todo) => !todo.completed)
  }
  if (currentFilter === 'completed') {
    return todos.filter((todo) => todo.completed)
  }
  return todos
}

function itemsLeft() {
  return todos.filter((todo) => !todo.completed).length
}

function applyVisibleOrder(visibleOrder) {
  const visibleSet = new Set(visibleOrder)
  const visibleMap = new Map(
    todos.filter((todo) => visibleSet.has(todo.id)).map((todo) => [todo.id, todo])
  )
  const reorderedVisible = visibleOrder
    .map((id) => visibleMap.get(id))
    .filter(Boolean)
  let index = 0
  todos = todos.map((todo) => {
    if (!visibleSet.has(todo.id)) return todo
    return reorderedVisible[index++]
  })
  saveTodos()
  render()
}

function moveTodoBy(id, delta) {
  const visible = filteredTodos().map((todo) => todo.id)
  const from = visible.indexOf(id)
  const to = from + delta
  if (from === -1 || to < 0 || to >= visible.length) return
  visible.splice(from, 1)
  visible.splice(to, 0, id)
  applyVisibleOrder(visible)
  announce(`已将事项移动到第 ${to + 1} 位。`)
}

function setSelection(id, selected) {
  if (selected) {
    selectedIds.add(id)
  } else {
    selectedIds.delete(id)
  }
}

function selectAllVisible() {
  filteredTodos().forEach((todo) => selectedIds.add(todo.id))
  render()
  announce('已全选当前列表。')
}

function clearSelection() {
  selectedIds.clear()
  render()
  announce('已清除选择。')
}

function completeSelected() {
  if (selectedIds.size === 0) return
  todos = todos.map((todo) =>
    selectedIds.has(todo.id) ? { ...todo, completed: true } : todo
  )
  saveTodos()
  render()
  announce('已标记所选事项为已完成。')
}

function deleteSelected() {
  if (selectedIds.size === 0) return
  todos = todos.filter((todo) => !selectedIds.has(todo.id))
  selectedIds.clear()
  saveTodos()
  render()
  announce('已删除所选事项。')
}

function updateBulkControls(items) {
  selectedCountEl.textContent = String(selectedIds.size)
  const hasSelection = selectedIds.size > 0
  bulkButtons.forEach((button) => {
    if (button.dataset.bulk === 'select-all') {
      button.disabled = items.length === 0
      return
    }
    if (button.dataset.bulk === 'clear-selection') {
      button.disabled = !hasSelection
      return
    }
    if (button.dataset.bulk === 'complete') {
      button.disabled = !hasSelection
      return
    }
    if (button.dataset.bulk === 'delete') {
      button.disabled = !hasSelection
    }
  })
}

function getDragInsertionIndex(clientY) {
  const elements = Array.from(list.querySelectorAll('.todo'))
  if (elements.length === 0) return 0
  for (let i = 0; i < elements.length; i += 1) {
    const rect = elements[i].getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    if (clientY < midpoint) return i
  }
  return elements.length
}

function applyDragOrderFromDom() {
  const visibleOrder = Array.from(list.querySelectorAll('.todo')).map(
    (item) => item.dataset.id
  )
  applyVisibleOrder(visibleOrder.filter(Boolean))
}

function render() {
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })

  const remaining = itemsLeft()
  countEl.textContent = remaining
  clearButton.disabled = todos.every((todo) => !todo.completed)

  list.innerHTML = ''
  const items = filteredTodos()

  if (items.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty-state'
    empty.textContent =
      currentFilter === 'completed'
        ? '暂无已完成的任务。'
        : currentFilter === 'active'
          ? '都处理完了，添加新事项吧。'
          : '列表还是空的，从第一条开始吧。'
    list.append(empty)
  } else {
    items.forEach((todo, index) => {
      const li = document.createElement('li')
      li.className = 'todo'
      if (todo.completed) li.classList.add('is-complete')
      if (selectedIds.has(todo.id)) li.classList.add('is-selected')
      if (editingId === todo.id) li.classList.add('is-editing')
      if (draggingId === todo.id) li.classList.add('is-dragging')
      li.dataset.id = todo.id
      li.setAttribute('aria-grabbed', String(draggingId === todo.id))

      if (editingId === todo.id) {
        const editInput = document.createElement('input')
        editInput.type = 'text'
        editInput.value = todo.title
        editInput.className = 'edit-input'
        editInput.setAttribute('data-edit-id', todo.id)
        editInput.setAttribute('aria-label', '编辑待办')

        editInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            saveEdit(todo.id, editInput.value)
          }
          if (event.key === 'Escape') {
            cancelEdit()
          }
        })

        const editActions = document.createElement('div')
        editActions.className = 'edit-actions'

        const saveButton = document.createElement('button')
        saveButton.type = 'button'
        saveButton.className = 'btn btn-primary btn-sm'
        saveButton.dataset.action = 'save'
        saveButton.textContent = '保存'

        const cancelButton = document.createElement('button')
        cancelButton.type = 'button'
        cancelButton.className = 'btn btn-ghost btn-sm'
        cancelButton.dataset.action = 'cancel'
        cancelButton.textContent = '取消'

        editActions.append(saveButton, cancelButton)
        li.append(editInput, editActions)
      } else {
        const select = document.createElement('input')
        select.type = 'checkbox'
        select.className = 'todo__select'
        select.checked = selectedIds.has(todo.id)
        select.setAttribute('aria-label', `选择 ${todo.title}`)

        const handle = document.createElement('button')
        handle.type = 'button'
        handle.className = 'drag-handle'
        handle.setAttribute('data-drag-handle', 'true')
        handle.setAttribute('aria-label', `拖动排序 ${todo.title}`)
        handle.textContent = '↕'

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'todo__toggle'
        checkbox.checked = todo.completed
        checkbox.setAttribute('aria-label', `将 ${todo.title} 标记为${
          todo.completed ? '未完成' : '已完成'
        }`)

        const content = document.createElement('div')
        content.className = 'todo__content'

        const title = document.createElement('span')
        title.className = 'todo__title'
        title.textContent = todo.title

        const actions = document.createElement('div')
        actions.className = 'todo__actions'

        const moveUpButton = document.createElement('button')
        moveUpButton.type = 'button'
        moveUpButton.className = 'btn btn-ghost btn-sm'
        moveUpButton.dataset.action = 'move-up'
        moveUpButton.textContent = '上移'
        moveUpButton.disabled = index === 0
        moveUpButton.setAttribute('aria-label', `将 ${todo.title} 上移`)

        const moveDownButton = document.createElement('button')
        moveDownButton.type = 'button'
        moveDownButton.className = 'btn btn-ghost btn-sm'
        moveDownButton.dataset.action = 'move-down'
        moveDownButton.textContent = '下移'
        moveDownButton.disabled = index === items.length - 1
        moveDownButton.setAttribute('aria-label', `将 ${todo.title} 下移`)

        const editButton = document.createElement('button')
        editButton.type = 'button'
        editButton.className = 'btn btn-ghost btn-sm'
        editButton.dataset.action = 'edit'
        editButton.textContent = '编辑'
        editButton.setAttribute('aria-label', `编辑 ${todo.title}`)

        const deleteButton = document.createElement('button')
        deleteButton.type = 'button'
        deleteButton.className = 'btn btn-danger btn-sm'
        deleteButton.dataset.action = 'delete'
        deleteButton.textContent = '删除'
        deleteButton.setAttribute('aria-label', `删除 ${todo.title}`)

        content.append(title)
        actions.append(moveUpButton, moveDownButton, editButton, deleteButton)
        li.append(select, handle, checkbox, content, actions)
      }

      list.append(li)
    })
  }

  updateBulkControls(items)

  if (editingId) {
    requestAnimationFrame(() => {
      const field = list.querySelector(`[data-edit-id="${editingId}"]`)
      if (field) {
        field.focus()
        field.setSelectionRange(field.value.length, field.value.length)
      }
    })
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  addTodo(input.value)
  input.value = ''
  input.focus()
})

list.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (target.matches('.todo__select')) {
    const item = target.closest('.todo')
    if (item?.dataset.id) {
      setSelection(item.dataset.id, target.checked)
      render()
    }
  }
  if (target.matches('.todo__toggle')) {
    const item = target.closest('.todo')
    if (item?.dataset.id) toggleTodo(item.dataset.id)
  }
})

list.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const actionButton = target.closest('button[data-action]')
  if (!actionButton) return
  const item = target.closest('.todo')
  if (!item?.dataset.id) return
  const id = item.dataset.id

  if (actionButton.dataset.action === 'delete') {
    deleteTodo(id)
  }
  if (actionButton.dataset.action === 'edit') {
    startEdit(id)
  }
  if (actionButton.dataset.action === 'move-up') {
    moveTodoBy(id, -1)
  }
  if (actionButton.dataset.action === 'move-down') {
    moveTodoBy(id, 1)
  }
  if (actionButton.dataset.action === 'save') {
    const field = item.querySelector('.edit-input')
    if (field) saveEdit(id, field.value)
  }
  if (actionButton.dataset.action === 'cancel') {
    cancelEdit()
  }
})

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setFilter(button.dataset.filter || 'all')
  })
})

clearButton.addEventListener('click', clearCompleted)

themeToggle.addEventListener('click', () => {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
  applyTheme(nextTheme)
  saveTheme(nextTheme)
})

bulkButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.bulk
    if (action === 'select-all') selectAllVisible()
    if (action === 'clear-selection') clearSelection()
    if (action === 'complete') completeSelected()
    if (action === 'delete') deleteSelected()
  })
})

list.addEventListener('pointerdown', (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const handle = target.closest('[data-drag-handle]')
  if (!handle) return
  const item = handle.closest('.todo')
  if (!item || item.classList.contains('is-editing')) return

  event.preventDefault()
  draggingId = item.dataset.id
  item.classList.add('is-dragging')
  item.setAttribute('aria-grabbed', 'true')
  handle.setPointerCapture(event.pointerId)
  announce('开始拖动，可在列表内移动排序。')

  const onPointerMove = (moveEvent) => {
    if (!draggingId) return
    const currentItem = list.querySelector(`.todo[data-id="${draggingId}"]`)
    if (!currentItem) return
    const insertIndex = getDragInsertionIndex(moveEvent.clientY)
    const items = Array.from(list.querySelectorAll('.todo'))
    const nextItem = items[insertIndex]
    if (nextItem && nextItem !== currentItem) {
      list.insertBefore(currentItem, nextItem)
    }
    if (!nextItem) {
      list.append(currentItem)
    }
  }

  const onPointerUp = () => {
    handle.releasePointerCapture(event.pointerId)
    draggingId = null
    applyDragOrderFromDom()
    announce('已更新排序。')
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
  }

  handle.addEventListener('pointermove', onPointerMove)
  handle.addEventListener('pointerup', onPointerUp)
  handle.addEventListener('pointercancel', onPointerUp)
})

render()
