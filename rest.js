import * as config from "./config.js";
import * as script from "./script.js";
const token__input = document.querySelector("#token__input");
const savetoken__btn = document.querySelector("#savetoken__btn");
const newProject__btn = document.querySelector("#addProjecBtn");
const emptyCard = {
    id: "",
    title: "",
    text: "",
    column: "",
    priority: "",
    color: "",
    reminder: "",
    createdAt: "",
  };

initialize()

async function initialize() {
  if (!localStorage.getItem("token")) {
    alert("Нет токена!");
    return; // Сразу выходим, чтобы не выполнять ветку else
  }

  try {
    const token = localStorage.getItem("token");
    
    token__input.value = token;
    document.querySelector("#token__text").textContent = token;
    
    // Параллельно или последовательно загружаем данные с сервера
    document.querySelector("#project__text").textContent = await getProjectName(token);
    
    await renderAll();
  } catch (error) {
    console.error("Критическая ошибка при инициализации:", error);
    alert("Не удалось загрузить данные с сервера. Проверьте соединение.");
  }
}

savetoken__btn.addEventListener("click", function () {
    if (!token__input.value) {
      alert("Введите токен!");
      return;
    }
    localStorage.setItem("token", `${token__input.value}`);
    alert("Токен успешно сохранен!");
    initialize()
  });

async function getProjectName(token){
    try {
    const response = await fetch(`http://${config.serverIp}:4200/api/projects`, {
      method: "GET",
      headers: {
        Authorization: `${token}`,
      },
    });
    let result = await response.json();
    console.log(result);
    return result.name
  } catch (error) {
    console.error("Ошибка прихода данных: " + error);
  }
}

async function getNotes() {
  try {
    const response = await fetch(`http://${config.serverIp}:4200/api/tasks`, {
      method: "GET",
      headers: {
        Authorization: `${localStorage.getItem("token")}`,
      },
    });
    let result = await response.json();
    console.log(result);
    return result
  } catch (error) {
    console.error("Ошибка прихода данных: " + error);
  }
}

newProject__btn.addEventListener("click", async function () {
  const projectName = document.querySelector("#project__input").value;

  if (!projectName.trim()) return;
    console.log("Нажалась")
  try {
    const response = await fetch(
      `http://${config.serverIp}:4200/api/projects`,
      {
        method: "POST",
        headers: {
          // ОБЯЗАТЕЛЬНО: говорим серверу, что отправляем JSON
          "content-type": "application/json",
        },
        // ОБЯЗАТЕЛЬНО: превращаем объект в строку
        body: JSON.stringify({
          name: projectName,
        }),
      },
    );

    if (!response.ok ) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    let result = await response.json();
    if (result[0].token != null)
    localStorage.setItem("token",result[0].token)
    console.log(localStorage.getItem("token"));
    console.log("Успех:", result);
    initialize()
  } catch (error) {
    console.error("Ошибка при отправке данных: " + error.message);
  }
});


export async function renderAll() {
    const notes = await getNotes()
  const columns = ['pending', 'inprogress', 'done', 'paused'];
  columns.forEach((col) => {
    const body = document.getElementById("body-" + col);
    const count = document.getElementById("count-" + col);
    const colNotes = notes.filter((n) => n.status === col);
    count.textContent = colNotes.length;
    body.innerHTML = "";
    colNotes.forEach((note) => {
      body.appendChild(script.createNoteElement(note));
    });
  });
}


