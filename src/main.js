import './style.css'

const STORAGE_KEY = 'todos.v1'

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
      <button class="btn btn-ghost clear-completed" type="button">清除已完成</button>
    </section>

    <ul class="todo-list" aria-live="polite"></ul>

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
const countEl = app.querySelector('[data-count]')

let todos = loadTodos()
let currentFilter = 'all'
let editingId = null

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
  todos = todos.filter((todo) => !todo.completed)
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
    items.forEach((todo) => {
      const li = document.createElement('li')
      li.className = 'todo'
      if (todo.completed) li.classList.add('is-complete')
      if (editingId === todo.id) li.classList.add('is-editing')
      li.dataset.id = todo.id

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
        actions.append(editButton, deleteButton)
        li.append(checkbox, content, actions)
      }

      list.append(li)
    })
  }

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

render()
