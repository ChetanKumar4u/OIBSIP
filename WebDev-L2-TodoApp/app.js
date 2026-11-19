(function () {
  "use strict";

  const STORAGE_KEY = "oibsip.daybook.tasks.v1";
  const form = document.getElementById("add-form");
  const input = document.getElementById("task-input");
  const pendingList = document.getElementById("pending-list");
  const completedList = document.getElementById("completed-list");
  const pendingCount = document.getElementById("pending-count");
  const completedCount = document.getElementById("completed-count");
  const pendingEmpty = document.getElementById("pending-empty");
  const completedEmpty = document.getElementById("completed-empty");
  const statusMessage = document.getElementById("status-message");
  const dateDisplay = document.getElementById("today-date");
  const tasks = loadTasks();

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.some((task) =>
        !task || typeof task.id !== "string" || typeof task.text !== "string" ||
        typeof task.createdAt !== "string" || typeof task.completed !== "boolean" ||
        !(task.completedAt === null || typeof task.completedAt === "string")
      )) throw new Error("Saved task data has an unexpected format.");
      return parsed;
    } catch (error) {
      statusMessage.textContent = `Saved tasks could not be loaded: ${error.message}`;
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      statusMessage.textContent = "";
      return true;
    } catch (error) {
      statusMessage.textContent = `Your latest change could not be saved: ${error.message}`;
      return false;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Time unavailable";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function makeButton(label, action, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    if (className) button.className = className;
    return button;
  }

  function createTaskRow(task) {
    const row = document.createElement("li");
    row.className = `task-row${task.completed ? " is-complete" : ""}`;
    row.dataset.taskId = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", task.completed ? `Mark ${task.text} as pending` : `Mark ${task.text} complete`);
    checkbox.dataset.action = "toggle";

    const main = document.createElement("div");
    main.className = "task-main";
    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;
    const time = document.createElement("time");
    time.className = "task-time";
    time.dateTime = task.completedAt || task.createdAt;
    time.textContent = task.completedAt
      ? `Added ${formatDate(task.createdAt)} · Completed ${formatDate(task.completedAt)}`
      : `Added ${formatDate(task.createdAt)}`;
    main.append(text, time);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.append(
      makeButton("Edit", "edit"),
      makeButton("Delete", "delete", "delete-button")
    );
    row.append(checkbox, main, actions);
    return row;
  }

  function render() {
    const pending = tasks.filter((task) => !task.completed);
    const completed = tasks.filter((task) => task.completed);
    pendingList.replaceChildren(...pending.map(createTaskRow));
    completedList.replaceChildren(...completed.map(createTaskRow));
    pendingCount.textContent = `${pending.length} pending`;
    completedCount.textContent = `${completed.length} completed`;
    pendingEmpty.hidden = pending.length > 0;
    completedEmpty.hidden = completed.length > 0;
  }

  function startEdit(task, row) {
    const formElement = document.createElement("form");
    formElement.className = "edit-form";
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.maxLength = 180;
    editInput.value = task.text;
    editInput.setAttribute("aria-label", "Edit task");
    const saveButton = makeButton("Save", "save", "save-button");
    saveButton.type = "submit";
    const cancelButton = makeButton("Cancel", "cancel");
    formElement.append(editInput, saveButton, cancelButton);
    row.replaceChildren(formElement);
    editInput.focus();
    editInput.select();
  }

  function handleListAction(event) {
    const control = event.target.closest("[data-action]");
    const row = event.target.closest("[data-task-id]");
    if (!control || !row) return;
    const taskIndex = tasks.findIndex((task) => task.id === row.dataset.taskId);
    if (taskIndex === -1) return;
    const task = tasks[taskIndex];

    if (control.dataset.action === "toggle") {
      task.completed = control.checked;
      task.completedAt = task.completed ? new Date().toISOString() : null;
    } else if (control.dataset.action === "delete") {
      tasks.splice(taskIndex, 1);
    } else if (control.dataset.action === "edit") {
      startEdit(task, row);
      return;
    } else if (control.dataset.action === "cancel") {
      render();
      return;
    } else {
      return;
    }
    saveTasks();
    render();
  }

  function handleEdit(event) {
    if (!event.target.matches(".edit-form")) return;
    event.preventDefault();
    const row = event.target.closest("[data-task-id]");
    const task = tasks.find((item) => item.id === row.dataset.taskId);
    const editedText = event.target.querySelector("input").value.trim();
    if (!editedText) {
      statusMessage.textContent = "A task cannot be empty.";
      event.target.querySelector("input").focus();
      return;
    }
    task.text = editedText;
    saveTasks();
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      statusMessage.textContent = "Enter a task before adding it.";
      input.focus();
      return;
    }
    tasks.unshift({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null
    });
    saveTasks();
    input.value = "";
    render();
    input.focus();
  });
  pendingList.addEventListener("click", handleListAction);
  completedList.addEventListener("click", handleListAction);
  pendingList.addEventListener("change", handleListAction);
  completedList.addEventListener("change", handleListAction);
  pendingList.addEventListener("submit", handleEdit);
  completedList.addEventListener("submit", handleEdit);
  dateDisplay.dateTime = new Date().toISOString();
  dateDisplay.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());
  render();
}());
