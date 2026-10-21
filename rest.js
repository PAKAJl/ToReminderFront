const API_URL = "http://localhost:3000";

const token__input = document.querySelector("#token__input")
const savetoken__btn = document.querySelector("#savetoken__btn")
const usetoken__btn = document.querySelector("#usetoken__btn")
const activeTokenDisplay = document.querySelector("#activeTokenDisplay")

const emptyCard = { id: '', title: '', text: '', column: 'pending', priority: 'low', color: 'white', reminder: '', createdAt: '' }

function getToken() {
    return localStorage.getItem("token")
}

function displayActiveToken() {
    const token = getToken()
    if (token) {
        activeTokenDisplay.textContent = token
        activeTokenDisplay.title = token
        activeTokenDisplay.classList.remove('token__value--empty')
    } else {
        activeTokenDisplay.textContent = "Не установлен"
        activeTokenDisplay.title = ""
        activeTokenDisplay.classList.add('token__value--empty')
    }
}

async function createProjectOnServer(name) {
    const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    })
    const result = await response.json()
    if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
    }
    return result[0].token
}

async function checkProjectOnServer(token) {
    const response = await fetch(`${API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
    }
    return result.name
}

savetoken__btn.addEventListener("click", async function () {
    const name = token__input.value.trim()
    if (!name) {
        showNotification("Введите название проекта!", "error")
        return
    }
    try {
        const token = await createProjectOnServer(name)
        localStorage.setItem("token", token)
        token__input.value = ''
        displayActiveToken()
        showNotification(`Проект «${name}» создан. Токен сохранён.`, "success", 6000)
        loadPage()
    } catch (error) {
        showNotification("Не удалось создать проект: " + error.message, "error")
    }
})

usetoken__btn.addEventListener("click", async function () {
    const token = token__input.value.trim()
    if (!token) {
        showNotification("Введите токен!", "error")
        return
    }
    try {
        const name = await checkProjectOnServer(token)
        localStorage.setItem("token", token)
        token__input.value = ''
        displayActiveToken()
        showNotification(`Подключён проект «${name}».`, "success")
        loadPage()
    } catch (error) {
        showNotification("Токен не найден на сервере: " + error.message, "error")
    }
})

function loadPage() {
    const token = getToken()
    if (!token) return
    getNotes(token)
}

function mapTaskToNote(task) {
    const note = { ...emptyCard }
    note.id = task.id
    note.title = task.title || ''
    note.text = task.description || ''
    note.column = task.status || 'pending'
    note.priority = task.priority || 'low'
    note.color = task.color || 'white'
    note.reminder = (!task.date || task.date === '-') ? '' : task.date
    note.createdAt = task.createdAt || Date.now()
    return note
}

function mapNoteToPayload(note) {
    return {
        title: note.title,
        description: note.text,
        status: note.column,
        priority: note.priority,
        date: note.reminder || '-',
        color: note.color,
        createdAt: note.createdAt
    }
}

async function getNotes(token) {
    try {
        const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        const result = await response.json()
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`)
        }
        notes = result.map(mapTaskToNote)
        renderAll()
    } catch (error) {
        showNotification("Не удалось загрузить задачи: " + error.message, "error")
    }
}

async function createNoteOnServer(noteData) {
    const token = getToken()
    const payload = mapNoteToPayload({ ...emptyCard, createdAt: Date.now(), ...noteData })
    const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    })
    const result = await response.json()
    if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
    }
    return mapTaskToNote(result)
}

async function updateNoteOnServer(id, noteData) {
    const token = getToken()
    const payload = { id, ...mapNoteToPayload(noteData) }
    const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    })
    const result = await response.json()
    if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
    }
    return mapTaskToNote(result)
}

async function deleteNoteOnServer(id) {
    const token = getToken()
    const response = await fetch(`${API_URL}/api/tasks/delete/?id=${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    const result = await response.json()
    if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
    }
    return true
}

if (getToken()) {
    token__input.value = ''
    displayActiveToken()
    loadPage()
} else {
    displayActiveToken()
}
