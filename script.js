let notes = [];
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
        deleteNote(draggedNoteId);
      }
    });

    function findNote(id) {
      return notes.find(n => String(n.id) === String(id));
    }

    function moveNoteToColumn(id, column) {
      const note = findNote(id);
      if (note && note.column !== column) {
        const prevColumn = note.column;
        note.column = column;
        renderAll();
        const columnNames = { pending: 'В ожидании', inprogress: 'В работе', done: 'Готово', paused: 'На паузе' };
        showNotification(`Заметка перемещена в «${columnNames[column]}»`, 'success');
        updateNoteOnServer(note.id, note).catch(error => {
          showNotification('Ошибка синхронизации: ' + error.message, 'error');
          note.column = prevColumn;
          renderAll();
        });
      }
    }

    async function deleteNote(id) {
      try {
        await deleteNoteOnServer(id);
        notes = notes.filter(n => String(n.id) !== String(id));
        if (reminderTimers[id]) {
          clearTimeout(reminderTimers[id]);
          delete reminderTimers[id];
        }
        renderAll();
        showNotification('Заметка удалена', 'error');
      } catch (error) {
        showNotification('Не удалось удалить заметку: ' + error.message, 'error');
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
      const note = findNote(id);
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

    function setColorOption(color) {
      document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
      const opt = document.querySelector(`[data-color="${color}"]`);
      if (opt) opt.classList.add('active');
      selectedColor = color;
    }

    document.getElementById('colorPicker').addEventListener('click', e => {
      const btn = e.target.closest('.color-option');
      if (btn) setColorOption(btn.dataset.color);
    });

    async function saveNote() {
      const title = document.getElementById('noteTitle').value.trim();
      if (!title) {
        document.getElementById('noteTitle').classList.add('form-input--error');
        document.getElementById('noteTitle').focus();
        return;
      }
      document.getElementById('noteTitle').classList.remove('form-input--error');

      const data = {
        title,
        text: document.getElementById('noteText').value.trim(),
        column: document.getElementById('noteColumn').value,
        priority: document.getElementById('notePriority').value,
        reminder: document.getElementById('noteReminder').value,
        color: selectedColor,
      };

      if (editingId) {
        const note = findNote(editingId);
        if (note) {
          const prev = { ...note };
          Object.assign(note, data);
          renderAll();
          closeModal();
          showNotification('Заметка обновлена', 'success');
          try {
            const serverNote = await updateNoteOnServer(note.id, note);
            Object.assign(note, serverNote);
            renderAll();
          } catch (error) {
            showNotification('Ошибка синхронизации: ' + error.message, 'error');
            Object.assign(note, prev);
            renderAll();
          }
        }
      } else {
        const newNote = { id: generateId(), createdAt: Date.now(), ...data };
        notes.push(newNote);
        renderAll();
        closeModal();
        showNotification('Заметка создана', 'success');
        try {
          const serverNote = await createNoteOnServer(data);
          const i = notes.findIndex(n => n.id === newNote.id);
          if (i !== -1) notes[i] = serverNote;
          renderAll();
        } catch (error) {
          showNotification('Ошибка синхронизации: ' + error.message, 'error');
          notes = notes.filter(n => n.id !== newNote.id);
          renderAll();
        }
      }
    }

    // =============================================
    //  REMINDER CHECKS
    // =============================================
    function setupReminderChecks() {
      Object.values(reminderTimers).forEach(t => clearTimeout(t));
      reminderTimers = {};
      notes.forEach(note => {
        if (!note.reminder) return;
        const t = new Date(note.reminder).getTime() - Date.now();
        if (t > 0 && t < 86400000 * 7) {
          reminderTimers[note.id] = setTimeout(() => {
            showReminderAlert(note);
          }, t);
        }
      });
    }

    function showReminderAlert(note) {
      showNotification(`⏰ Напоминание: «${note.title}»`, 'reminder', 8000);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('NoteFlow — Напоминание', { body: note.title, icon: '' });
      }
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

    // =============================================
    //  INIT
    // =============================================
    renderAll();

    // Demo notes only when project token is not set (backend not connected yet)
    if (!localStorage.getItem('token') && notes.length === 0) {
      const demoNotes = [
        { id: generateId(), title: 'Изучить новый фреймворк', text: 'Посмотреть документацию и туториалы по Vue 3', column: 'pending', priority: 'high', color: 'white', reminder: '', createdAt: Date.now() - 86400000 },
        { id: generateId(), title: 'Дизайн главной страницы', text: 'Нарисовать wireframe и согласовать с командой', column: 'inprogress', priority: 'medium', color: 'mint', reminder: '', createdAt: Date.now() - 3600000 },
        { id: generateId(), title: 'Настроить CI/CD', text: 'GitHub Actions для автодеплоя', column: 'inprogress', priority: 'high', color: 'teal', reminder: '', createdAt: Date.now() - 7200000 },
        { id: generateId(), title: 'Написать тесты', text: 'Unit-тесты для основных компонентов', column: 'done', priority: 'medium', color: 'green', reminder: '', createdAt: Date.now() - 172800000 },
        { id: generateId(), title: 'Обновить зависимости', text: '', column: 'paused', priority: 'low', color: 'yellow', reminder: '', createdAt: Date.now() - 259200000 },
      ];
      notes = demoNotes;
      renderAll();
    }
