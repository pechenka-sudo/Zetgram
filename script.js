// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  remove,
  get,
  set,
  query,
  orderByChild,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTZrRKHrmKnA9ycBWvt9ephnr7TN6ZFs8",
  authDomain: "zetgram-d2b77.firebaseapp.com",
  databaseURL: "https://zetgram-d2b77-default-rtdb.firebaseio.com",
  projectId: "zetgram-d2b77",
  storageBucket: "zetgram-d2b77.appspot.com",
  messagingSenderId: "804686454",
  appId: "1:804686454:web:db9f618955e3d370deed57",
  measurementId: "G-KCYSRCX4ZL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const appEl = document.getElementById("app");

let currentUser = null;
let messages = [];

function createElem(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function renderLoading() {
  appEl.innerHTML = "<p style='padding:20px;color:#ff4c4c;'>Загрузка...</p>";
}

function renderAuthForm() {
  appEl.innerHTML = "";

  const container = createElem("div", "auth-container");
  const title = createElem("h1", "auth-title", authMode === "signin" ? "Вход в ZetGram" : "Регистрация в ZetGram");

  container.appendChild(title);

  if (authMode === "signup") {
    const nickInput = createElem("input");
    nickInput.type = "text";
    nickInput.placeholder = "Ник (уникальный)";
    nickInput.maxLength = 15;
    nickInput.id = "nickname-input";
    container.appendChild(nickInput);
  }

  const emailInput = createElem("input");
  emailInput.type = "email";
  emailInput.placeholder = "Email";
  emailInput.id = "email-input";
  container.appendChild(emailInput);

  const passInput = createElem("input");
  passInput.type = "password";
  passInput.placeholder = "Пароль";
  passInput.id = "password-input";
  container.appendChild(passInput);

  const btn = createElem("button", null, authMode === "signin" ? "Войти" : "Зарегистрироваться");
  container.appendChild(btn);

  const switchText = createElem("div", "auth-switch", authMode === "signin" ? "Нет аккаунта? Зарегистрируйтесь" : "Уже есть аккаунт? Войдите");
  container.appendChild(switchText);

  appEl.appendChild(container);

  btn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const nickname = authMode === "signup" ? document.getElementById("nickname-input").value.trim() : null;

    if (authMode === "signin") {
      if (!email || !password) {
        alert("Введите email и пароль");
        return;
      }
      signIn(email, password);
    } else {
      if (!email || !password || !nickname) {
        alert("Заполните все поля");
        return;
      }
      signUp(email, password, nickname);
    }
  });

  switchText.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    renderAuthForm();
  });
}

async function signUp(email, password, nickname) {
  try {
    // Проверка уникальности ника
    const nickRef = ref(db, "nicknames/" + nickname.toLowerCase());
    const snap = await get(nickRef);
    if (snap.exists()) {
      alert("Ник уже занят");
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;

    await set(ref(db, "nicknames/" + nickname.toLowerCase()), currentUser.uid);
    await updateProfile(currentUser, { displayName: nickname });

    alert("Регистрация успешна! Войдите в систему.");
    authMode = "signin";
    renderAuthForm();

  } catch (e) {
    alert("Ошибка регистрации: " + e.message);
  }
}

async function signIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    renderApp();
  } catch (e) {
    alert("Ошибка входа: " + e.message);
  }
}

function logout() {
  signOut(auth);
  currentUser = null;
  messages = [];
  renderAuthForm();
}

function renderApp() {
  appEl.innerHTML = "";

  const header = createElem("header");
  header.innerHTML = `ZetGram — Привет, <strong>${currentUser.displayName || "Без имени"}</strong>`;
  const logoutBtn = createElem("button", null, "Выйти");
  logoutBtn.addEventListener("click", logout);
  header.appendChild(logoutBtn);
  appEl.appendChild(header);

  const main = createElem("main");

  const chatContainer = createElem("div", "chat-container");
  main.appendChild(chatContainer);

  const form = document.createElement("form");
  form.style.display = "flex";
  form.style.marginTop = "12px";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Напишите сообщение...";
  textarea.style.flex = "1";
  textarea.style.borderRadius = "5px";
  textarea.style.padding = "10px";
  textarea.style.fontSize = "1rem";
  textarea.style.resize = "none";
  textarea.style.background = "#330000";
  textarea.style.color = "white";
  textarea.style.border = "none";
  textarea.style.outline = "none";

  form.appendChild(textarea);

  const sendBtn = createElem("button", null, "Отправить");
  form.appendChild(sendBtn);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(textarea.value.trim());
    textarea.value = "";
  });

  main.appendChild(form);

  appEl.appendChild(main);

  const footer = createElem("footer", "footer", "© 2025 ZetGram");
  appEl.appendChild(footer);

  loadMessages(chatContainer);
}

function loadMessages(container) {
  container.innerHTML = "";
  messages = [];

  const messagesRef = ref(db, "messages");
  const messagesQuery = query(messagesRef, orderByChild("timestamp"));

  onChildAdded(messagesQuery, (data) => {
    const msg = { id: data.key, ...data.val() };
    messages.push(msg);
    renderMessage(msg, container);
    container.scrollTop = container.scrollHeight;
  });
}

function renderMessage(msg, container) {
  const isMine = msg.uid === currentUser.uid;

  const messageEl = createElem("div", "message " + (isMine ? "mine" : "other"));
  messageEl.tabIndex = 0;
  messageEl.setAttribute("role", "article");
  messageEl.setAttribute("aria-label", `Сообщение от ${msg.author}: ${msg.text}`);

  const authorEl = createElem("div", "author", msg.author);
  const textEl = createElem("div", "text", msg.text);
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const timestampEl = createElem("div", "timestamp", timeStr);

  messageEl.appendChild(authorEl);
  messageEl.appendChild(textEl);
  messageEl.appendChild(timestampEl);

  if (isMine) {
    const delBtn = createElem("button", "delete-btn", "×");
    delBtn.setAttribute("aria-label", "Удалить сообщение");
    delBtn.addEventListener("click", () => deleteMessage(msg.id));
    messageEl.appendChild(delBtn);
  }

  container.appendChild(messageEl);
}

async function sendMessage(text) {
  if (!text) return;

  const msg = {
    text,
    uid: currentUser.uid,
    author: currentUser.displayName || "Без имени",
    timestamp: Date.now(),
  };

  try {
    await push(ref(db, "messages"), msg);
  } catch (e) {
    alert("Ошибка отправки: " + e.message);
  }
}

async function deleteMessage(id) {
  if (!confirm("Удалить сообщение?")) return;

  try {
    await remove(ref(db, "messages/" + id));
    // Удаляем из массива и из DOM
    messages = messages.filter(m => m.id !== id);
    renderApp();
  } catch (e) {
    alert("Ошибка удаления: " + e.message);
  }
}

let authMode = "signin";

renderLoading();

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    renderApp();
  } else {
    currentUser = null;
    renderAuthForm();
  }
});
