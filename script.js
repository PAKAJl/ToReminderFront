
import * as config from "./config.js";
import * as rest from "./rest.js";

let notes = JSON.parse(localStorage.getItem('noteflow_notes') || '[]');
    let editingId = null;
    let draggedNoteId = null;
    let reminderTimers = {};
    let selectedColor = 'white';


    function generateId() {
      return 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    

    function escapeHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // =============================================
    //  DRAG & DROP
    // =============================================
    function onDragStart(e) {
  const el = e.currentTarget;        // сохраняем ссылку ДО setTimeout
  draggedNoteId = el.dataset.id;
  el.classList.add('note--dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNoteId);
  document.getElementById('trashZone').classList.add('trash-zone--visible');
  setTimeout(() => {
    if (el) el.style.opacity = '0.4'; // el жив через замыкание
  }, 0);
}

    function onDragEnd(e) {
      e.currentTarget.classList.remove('note--dragging');
      e.currentTarget.style.opacity = '1';
      document.getElementById('trashZone').classList.remove('trash-zone--visible', 'trash-zone--active');
      draggedNoteId = null;
      document.querySelectorAll('.column__body').forEach(b => b.classList.remove('column__body--dragover'));
    }

    // Column drop zones
    document.querySelectorAll('.column__body').forEach(body => {
      body.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        body.classList.add('column__body--dragover');
      });
      body.addEventListener('dragleave', e => {
        if (!body.contains(e.relatedTarget)) {
          body.classList.remove('column__body--dragover');
        }
      });
      body.addEventListener('drop',async e => {
        e.preventDefault();
        body.classList.remove('column__body--dragover');
        const targetColumn = body.dataset.column;
        if (draggedNoteId) {
          await moveNoteToColumn(draggedNoteId, targetColumn);
        }
      });
    });

    // Trash zone
    const trashZone = document.getElementById('trashZone');
    trashZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      trashZone.classList.add('trash-zone--active');
    });
    trashZone.addEventListener('dragleave', e => {
      if (!trashZone.contains(e.relatedTarget)) {
        trashZone.classList.remove('trash-zone--active');
      }
    });
    trashZone.addEventListener('drop', async e => {
      e.preventDefault();
      trashZone.classList.remove('trash-zone--active', 'trash-zone--visible');
      if (draggedNoteId) {
        await deleteNote(draggedNoteId);
        showNotification('Заметка удалена', 'error');
      }
    });

    async function moveNoteToColumn(id, column) {
      const note = notes.find(n => n.id === id);
      if (note && note.column !== column) {
        note.column = column;
        await rest.renderAll();
        const columnNames = { pending: 'В ожидании', inprogress: 'В работе', done: 'Готово', paused: 'На паузе' };
        showNotification(`Заметка перемещена в «${columnNames[column]}»`, 'success');
      }
    }

   

    // =============================================
    //  MODAL
    // =============================================
    function openAddModal(column) {
      editingId = null;
      selectedColor = 'white';
      document.getElementById('modalTitle').textContent = 'Новая заметка';
      document.getElementById('noteTitle').value = '';
      document.getElementById('noteText').value = '';
      document.getElementById('noteColumn').value = column || 'pending';
      document.getElementById('notePriority').value = 'medium';
      document.getElementById('modalOverlay').classList.add('modal-overlay--visible');
      document.getElementById('noteTitle').focus();
    }

    function openEditModal(id) {
      const note = notes.find(n => n.id === id);
      if (!note) return;
      editingId = id;
      document.getElementById('modalTitle').textContent = 'Редактировать заметку';
      document.getElementById('noteTitle').value = note.title;
      document.getElementById('noteText').value = note.text || '';
      document.getElementById('noteColumn').value = note.column;
      document.getElementById('notePriority').value = note.priority || 'low';
      document.getElementById('modalOverlay').classList.add('modal-overlay--visible');
      document.getElementById('noteTitle').focus();
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('modal-overlay--visible');
      editingId = null;
    }

  

  

    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // =============================================
    //  NOTIFICATIONS UI
    // =============================================
    function showNotification(message, type = 'success', duration = 3000) {
      const container = document.getElementById('notificationContainer');
      const notif = document.createElement('div');
      notif.className = `notification notification--${type}`;
      const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>',
        reminder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
      };
      notif.innerHTML = `<span class="notification__icon">${icons[type] || icons.success}</span><span>${message}</span>`;
      container.appendChild(notif);
      requestAnimationFrame(() => notif.classList.add('notification--show'));
      setTimeout(() => {
        notif.classList.remove('notification--show');
        setTimeout(() => notif.remove(), 400);
      }, duration);
    }

    // =============================================
    //  EVENT LISTENERS
    // =============================================
    document.getElementById('addNoteBtn').addEventListener('click', () => openAddModal('pending'));
    document.querySelectorAll('.column__add-btn').forEach(btn => {
      btn.addEventListener('click', () => openAddModal(btn.dataset.column));
    });

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalSave').addEventListener('click', saveNote);

    document.getElementById('modalOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modalOverlay')) closeModal();
    });

    document.getElementById('noteTitle').addEventListener('input', function() {
      this.classList.remove('form-input--error');
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
    });

  //Обновлено

    export async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  
  // 1. Валидация (остается на клиенте для скорости)
  if (!title) {
    document.getElementById('noteTitle').classList.add('form-input--error');
    document.getElementById('noteTitle').focus();
    return;
  }
  document.getElementById('noteTitle').classList.remove('form-input--error');

  // 2. Сбор данных
  const data = {
    title : document.getElementById('noteTitle').value.trim(),
    description: document.getElementById('noteText').value.trim(),
    status: document.getElementById('noteColumn').value,
    priority: document.getElementById('notePriority').value,
  };

  try {
    let response;
    
    if (editingId) {
      // 3а. Обновление существующей заметки (PUT или PATCH)
      response = await fetch(`http://${config.serverIp}:4200/api/tasks`, {
        method: 'PUT',
        headers: { 
          'content-type': 'application/json',
          Authorization: `${localStorage.getItem("token")}`,
         },
        body: JSON.stringify(data),
      });
    } else {
      // 3б. Создание новой заметки (POST)
      response = await fetch(`http://${config.serverIp}:4200/api/tasks`, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          Authorization: `${localStorage.getItem("token")}`,
         },
        body: JSON.stringify(data),
      });
    }

    if (!response.ok) throw new Error('Ошибка при сохранении на сервере');

    const result = await response.json();

    // 4. Локальное обновление состояния (необязательно, если renderAll делает новый запрос)
    showNotification(
      editingId ? 'Заметка обновлена' : 'Заметка создана', 
      'success'
    );

    // 5. Завершение
    await rest.renderAll(); // В идеале renderAll теперь тоже асинхронный и тянет данные с сервера
    closeModal();
    
  } catch (error) {
    console.error(error);
    showNotification('Ошибка связи с сервером', 'error');
  }
}

export function createNoteElement(note) {
      const card = document.createElement('div');
      card.className = `note note--${note.color || 'white'} note--${note.priority || 'low'}-priority`;
      card.dataset.id = note.id;
      card.draggable = true;


      const priorityLabel = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }[note.priority || 'low'];

      card.innerHTML = `
        <div class="note__drag-handle">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </div>
        <div class="note__priority-bar"></div>
        <div class="note__content">
          <div class="note__top">
            <span class="note__priority-badge note__priority-badge--${note.priority || 'low'}">${priorityLabel}</span>
            <div class="note__actions">
              <button class="note__action-btn" data-action="edit" data-id="${note.id}" title="Редактировать">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="note__action-btn note__action-btn--delete" data-action="delete" data-id="${note.id}" title="Удалить">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
          <h3 class="note__title">${escapeHtml(note.title)}</h3>
          ${note.description ? `<p class="note__text">${escapeHtml(note.description)}</p>` : ''}
          
        </div>
      `;

      // Drag events
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragend', onDragEnd);

      // Action buttons
      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click',async e => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          if (action === 'edit') openEditModal(id);
          if (action === 'delete') await deleteNote(id);
        });
      });

      return card;
    }

    async function deleteNote(id) {
  // 1. Фильтруем локальный массив (если он ещё используется)
  notes = notes.filter(n => n.id !== id);

  try {
    // 2. Добавляем const перед response, чтобы объявить переменную
    const response = await fetch(`http://${config.serverIp}:4200/api/tasks/delete/?id=${id}`, {
      method: 'GET', // Обратите внимание: обычно для удаления используют метод DELETE, но если ваше API требует GET — оставляйте так
      headers: { 
        Authorization: `${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error('Не удалось удалить заметку на сервере');
    }

    // 3. Дожидаемся обновления интерфейса
    await rest.renderAll(); 
    
  } catch (error) {
    console.error("Ошибка при удалении:", error);
    alert("Произошла ошибка при удалении заметки.");
  }
}