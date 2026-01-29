import './style.css'

const STORAGE_KEY = 'todos.v1'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="app" aria-label="Todo application">
    <header class="app__header">
      <div>
        <span class="pill">Today</span>
        <h1>Todo Studio</h1>
        <p class="subtitle">Plan with clarity, finish with momentum.</p>
      </div>
    </header>

    <form class="add-form" aria-label="Add a todo">
      <label class="sr-only" for="new-todo">Add a todo</label>
      <input
        id="new-todo"
        name="new-todo"
        type="text"
        placeholder="Add a task and press Enter"
        autocomplete="off"
      />
      <button class="btn btn-primary" type="submit">Add</button>
    </form>

    <section class="toolbar" aria-label="Todo filters and actions">
      <div class="filters" role="tablist" aria-label="Filter todos">
        <button class="filter-btn" type="button" data-filter="all" aria-pressed="true">All</button>
        <button class="filter-btn" type="button" data-filter="active" aria-pressed="false">Active</button>
        <button class="filter-btn" type="button" data-filter="completed" aria-pressed="false">Completed</button>
      </div>
      <button class="btn btn-ghost clear-completed" type="button">Clear completed</button>
    </section>

    <ul class="todo-list" aria-live="polite"></ul>

    <footer class="app__footer">
      <span class="count"><strong data-count>0</strong> items left</span>
      <span class="hint">Tip: Enter to add, Enter to save, Esc to cancel edit.</span>
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
        ? 'No completed tasks yet.'
        : currentFilter === 'active'
          ? 'All caught up. Add a new task.'
          : 'Your list is empty. Start with one task.'
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
        editInput.setAttribute('aria-label', 'Edit todo')

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
        saveButton.textContent = 'Save'

        const cancelButton = document.createElement('button')
        cancelButton.type = 'button'
        cancelButton.className = 'btn btn-ghost btn-sm'
        cancelButton.dataset.action = 'cancel'
        cancelButton.textContent = 'Cancel'

        editActions.append(saveButton, cancelButton)
        li.append(editInput, editActions)
      } else {
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'todo__toggle'
        checkbox.checked = todo.completed
        checkbox.setAttribute('aria-label', `Mark ${todo.title} as ${
          todo.completed ? 'incomplete' : 'complete'
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
        editButton.textContent = 'Edit'
        editButton.setAttribute('aria-label', `Edit ${todo.title}`)

        const deleteButton = document.createElement('button')
        deleteButton.type = 'button'
        deleteButton.className = 'btn btn-danger btn-sm'
        deleteButton.dataset.action = 'delete'
        deleteButton.textContent = 'Delete'
        deleteButton.setAttribute('aria-label', `Delete ${todo.title}`)

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
