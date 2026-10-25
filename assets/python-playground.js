/** Run lesson code in an isolated browser worker using Pyodide. */
"use strict";

let browserPythonWorker = null;
let browserPythonReady = false;
let browserPythonPending = null;
let browserPythonLesson = null;
let browserPythonInitializationTimer = null;
let browserPythonExecutionTimer = null;
let desktopPythonInfo = null;
let desktopPythonBusy = false;

function isBrowserPythonBusy() {
  return desktopPythonBusy || browserPythonPending !== null || browserPythonLesson !== null;
}

function hasDesktopPythonBridge() {
  return Boolean(window.courseDesktop && window.courseDesktop.isElectron &&
    typeof window.courseDesktop.detectPython === "function" &&
    typeof window.courseDesktop.runPython === "function");
}

function updatePythonRuntime(text, lessonId = visiblePythonLesson()) {
  if (lessonId !== visiblePythonLesson()) return;
  const runtime = document.getElementById("python-runtime-label");
  if (runtime) runtime.textContent = text;
}

function visiblePythonLesson() {
  const lesson = document.querySelector(".lesson");
  return lesson ? Number(lesson.dataset.lesson) : null;
}

function updatePythonStatus(text, lessonId = visiblePythonLesson()) {
  if (lessonId !== visiblePythonLesson()) return;
  const status = document.getElementById("python-status");
  if (status) status.textContent = text;
}

function appendPythonOutput(text, lessonId = visiblePythonLesson()) {
  if (lessonId !== visiblePythonLesson()) return;
  const output = document.getElementById("python-output");
  if (output) output.textContent += text;
}

function clearPythonTimers() {
  window.clearTimeout(browserPythonInitializationTimer);
  window.clearTimeout(browserPythonExecutionTimer);
  browserPythonInitializationTimer = null;
  browserPythonExecutionTimer = null;
}

function finishBrowserPython(message, failed = false) {
  clearPythonTimers();
  const finishedLesson = browserPythonLesson;
  browserPythonLesson = null;
  browserPythonPending = null;
  const button = document.getElementById("run-python");
  if (button) button.disabled = false;
  updatePythonStatus(message, finishedLesson);
  if (finishedLesson !== visiblePythonLesson() && document.getElementById("python-status")) {
    updatePythonStatus("La ejecución anterior terminó. Ya puedes ejecutar esta lección.");
  }
  if (failed && finishedLesson === visiblePythonLesson()) announce(message);
}

function showPythonDownload(message) {
  if (browserPythonLesson !== visiblePythonLesson()) return;
  const container = document.querySelector(".python-download");
  const progress = document.getElementById("python-download-progress");
  const caption = document.getElementById("python-download-caption");
  if (!container || !progress || !caption) return;
  container.hidden = false;
  if (message.total) {
    progress.max = message.total;
    progress.value = Math.min(message.loaded, message.total);
    caption.textContent = "Descargando " + message.name + "… " +
      Math.round(message.loaded / message.total * 100) + "%";
  } else {
    progress.removeAttribute("value");
    caption.textContent = "Descargando " + message.name + "… " +
      formatPythonBytes(message.loaded);
  }
  updatePythonStatus("La primera descarga puede tardar. Mantén esta ventana abierta.");
}

function formatPythonBytes(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function sendBrowserPythonRun() {
  if (!browserPythonPending || !browserPythonWorker) return;
  const request = browserPythonPending;
  browserPythonPending = null;
  browserPythonLesson = request.lessonId;
  browserPythonWorker.postMessage({
    type: "run", code: request.code, input: request.input, filename: request.filename
  });
  updatePythonStatus("Ejecutando…", request.lessonId);
}

function startBrowserPythonExecutionTimer(lessonId) {
  browserPythonExecutionTimer = window.setTimeout(() => {
    if (browserPythonWorker) browserPythonWorker.terminate();
    browserPythonWorker = null;
    browserPythonReady = false;
    appendPythonOutput("\n⏹ Ejecución detenida tras 15 segundos; revisa si hay un ciclo que no termina.", lessonId);
    finishBrowserPython("El programa tardó demasiado y se detuvo.", true);
  }, 15000);
}

function handlePythonWorkerMessage(message) {
  if (message.type === "progress") {
    showPythonDownload(message);
    if (browserPythonInitializationTimer) {
      window.clearTimeout(browserPythonInitializationTimer);
      browserPythonInitializationTimer = window.setTimeout(() => failBrowserPython(
        "La descarga tardó demasiado. Revisa tu conexión e inténtalo de nuevo."
      ), 180000);
    }
  } else if (message.type === "status") {
    updatePythonStatus(message.text);
  } else if (message.type === "ready") {
    browserPythonReady = true;
    const progress = document.querySelector(".python-download");
    if (progress && browserPythonLesson === visiblePythonLesson()) progress.hidden = true;
    if (browserPythonPending) sendBrowserPythonRun();
  } else if (message.type === "started") {
    window.clearTimeout(browserPythonInitializationTimer);
    browserPythonInitializationTimer = null;
    if (browserPythonLesson !== null) startBrowserPythonExecutionTimer(browserPythonLesson);
  } else if (message.type === "output") {
    appendPythonOutput(message.text, browserPythonLesson);
  } else if (message.type === "done") {
    finishBrowserPython("Programa terminado. Puedes editarlo y volver a ejecutar.");
  } else if (message.type === "error") {
    appendPythonOutput(message.message + (message.details ? "\n" + message.details : ""),
      browserPythonLesson);
    if (message.stage === "ejecutar tu programa") {
      finishBrowserPython("Python encontró un error. Revisa la consola y prueba otra vez.", true);
    } else {
      console.error("Pyodide no pudo inicializarse.", message.stage, message.message, message.details);
      failBrowserPython("No se pudo " + message.stage + ": " + message.message);
    }
  }
}

function failBrowserPython(message) {
  if (browserPythonWorker) browserPythonWorker.terminate();
  browserPythonWorker = null;
  browserPythonReady = false;
  const failedLesson = browserPythonLesson ||
    (browserPythonPending && browserPythonPending.lessonId) || visiblePythonLesson();
  browserPythonPending = null;
  browserPythonLesson = failedLesson;
  const progress = document.querySelector(".python-download");
  if (progress) progress.hidden = true;
  finishBrowserPython("No se pudo preparar Python. " + message, true);
}

function createBrowserPythonWorker() {
  browserPythonWorker = new Worker("assets/python-worker.js");
  browserPythonWorker.addEventListener("message", (event) => handlePythonWorkerMessage(event.data));
  browserPythonWorker.addEventListener("error", (event) => {
    console.error("No se pudo iniciar el trabajador de Python.", event.message, event.filename, event.lineno);
    failBrowserPython("El navegador no pudo iniciar el intérprete. " + event.message);
  });
}

async function runPreferredPython(button) {
  if (!hasDesktopPythonBridge()) {
    runBrowserPython(button);
    return;
  }
  if (isBrowserPythonBusy()) {
    announce("Espera a que termine el programa actual antes de ejecutar otro.");
    return;
  }

  const editor = document.getElementById("python-code-editor");
  const input = document.getElementById("python-input");
  const lessonId = Number(editor.dataset.lessonId);
  if (!editor.value.trim()) {
    announce("Escribe una instrucción Python antes de ejecutar.");
    editor.focus();
    return;
  }
  const lesson = COURSE.lessons.find((item) => item.id === lessonId);
  const request = { code: editor.value, input: input.value, filename: lesson.example };
  learnerProgress.drafts[lessonId] = editor.value;
  saveProgress();

  desktopPythonBusy = true;
  button.disabled = true;
  document.getElementById("python-output").textContent = "";
  updatePythonStatus("Buscando y comprobando Python instalado…", lessonId);

  let info;
  try {
    info = desktopPythonInfo || await window.courseDesktop.detectPython();
    desktopPythonInfo = info;
  } catch (error) {
    info = { available: false, error: error.message || String(error) };
  }

  if (!info.available) {
    desktopPythonBusy = false;
    button.disabled = false;
    updatePythonRuntime("Python local no encontrado · respaldo Pyodide", lessonId);
    updatePythonStatus("No se encontró Python local. Usando Pyodide como respaldo…", lessonId);
    runBrowserPython(button);
    return;
  }

  updatePythonRuntime("Python " + info.version + " local · " + info.executable, lessonId);
  updatePythonStatus("Ejecutando con Python local…", lessonId);
  try {
    const result = await window.courseDesktop.runPython(request);
    if (result.unavailable) {
      desktopPythonInfo = null;
      desktopPythonBusy = false;
      button.disabled = false;
      updatePythonStatus("Python local dejó de estar disponible. Usando Pyodide como respaldo…", lessonId);
      runBrowserPython(button);
      return;
    }
    if (result.python) {
      desktopPythonInfo = result.python;
      updatePythonRuntime("Python " + result.python.version + " local · " + result.python.executable, lessonId);
    }
    appendPythonOutput(result.stdout || "", lessonId);
    appendPythonOutput(result.stderr || "", lessonId);
    if (result.timedOut) {
      updatePythonStatus("El programa tardó demasiado y se detuvo.", lessonId);
      announce("El programa tardó demasiado y se detuvo.");
    } else if (result.ok) {
      updatePythonStatus("Programa terminado con Python local. Puedes editarlo y volver a ejecutar.", lessonId);
    } else {
      if (result.error) appendPythonOutput(result.error + "\n", lessonId);
      updatePythonStatus("Python terminó con un error. Revisa la consola y prueba otra vez.", lessonId);
    }
  } catch (error) {
    appendPythonOutput((error.message || String(error)) + "\n", lessonId);
    updatePythonStatus("No se pudo ejecutar Python local. Revisa la consola.", lessonId);
  } finally {
    desktopPythonBusy = false;
    button.disabled = false;
  }
}

function runBrowserPython(button) {
  if (isBrowserPythonBusy()) {
    announce("Espera a que termine el programa actual antes de ejecutar otro.");
    return;
  }
  if (location.protocol === "file:") {
    const output = document.getElementById("python-output");
    if (output) output.textContent =
      "El navegador bloquea los Web Workers cuando abres index.html directamente con file://.\n\n" +
      "Desde C:\\Dev\\programming-course usa:\n" +
      "  pnpm start   → Electron + Python instalado en tu laptop\n" +
      "  pnpm web     → navegador + Pyodide\n";
    updatePythonRuntime("file:// bloqueado para Web Workers");
    updatePythonStatus("Abre el curso con «pnpm start» o «pnpm web».");
    button.disabled = false;
    return;
  }
  const editor = document.getElementById("python-code-editor");
  const input = document.getElementById("python-input");
  const lessonId = Number(editor.dataset.lessonId);
  if (!editor.value.trim()) {
    announce("Escribe una instrucción Python antes de ejecutar.");
    editor.focus();
    return;
  }
  learnerProgress.drafts[lessonId] = editor.value;
  saveProgress();
  document.getElementById("python-output").textContent = "";
  button.disabled = true;
  const lesson = COURSE.lessons.find((item) => item.id === lessonId);
  browserPythonPending = {
    code: editor.value, input: input.value, lessonId, filename: lesson.example
  };
  if (!browserPythonWorker) {
    try {
      createBrowserPythonWorker();
    } catch (error) {
      console.error("No se pudo crear el trabajador de Python.", error);
      failBrowserPython(error.message);
      return;
    }
  }
  if (browserPythonReady) {
    browserPythonInitializationTimer = window.setTimeout(() => failBrowserPython(
      "Python tardó demasiado en preparar la ejecución. Inténtalo de nuevo."
    ), 180000);
    sendBrowserPythonRun();
    return;
  }
  updatePythonStatus("Preparando Python… La primera descarga necesita internet.", lessonId);
  if (!browserPythonInitializationTimer) {
    browserPythonInitializationTimer = window.setTimeout(() => failBrowserPython(
      "La descarga tardó demasiado. Revisa tu conexión e inténtalo de nuevo."
    ), 180000);
  }
  sendBrowserPythonRun();
}

function resetBrowserPython() {
  const editor = document.getElementById("python-code-editor");
  const lessonId = Number(editor.dataset.lessonId);
  const lesson = COURSE.lessons.find((item) => item.id === lessonId);
  editor.value = lesson.code;
  document.getElementById("python-input").value = lesson.stdin || "";
  learnerProgress.drafts[lessonId] = lesson.code;
  saveProgress();
  document.getElementById("python-output").textContent = "La consola está lista. Pulsa «Ejecutar Python».";
  if (hasDesktopPythonBridge()) {
    updatePythonRuntime(desktopPythonInfo?.available
      ? "Python " + desktopPythonInfo.version + " local · " + desktopPythonInfo.executable
      : "Detectando Python local…", lessonId);
    updatePythonStatus("La aplicación buscará automáticamente el Python instalado en tu equipo.", lessonId);
  } else if (location.protocol === "file:") {
    updatePythonRuntime("file:// · usa pnpm start o pnpm web", lessonId);
    updatePythonStatus("El navegador bloquea Web Workers desde file://.", lessonId);
  } else {
    updatePythonRuntime("Pyodide · se ejecuta en tu navegador", lessonId);
    updatePythonStatus("La primera ejecución requiere conexión a internet.", lessonId);
  }
  editor.focus();
}

document.getElementById("main-content").addEventListener("input", (event) => {
  if (event.target.id !== "python-code-editor") return;
  learnerProgress.drafts[Number(event.target.dataset.lessonId)] = event.target.value;
  saveProgress();
});

document.getElementById("main-content").addEventListener("click", (event) => {
  const button = event.target.closest("[data-python-action]");
  if (!button) return;
  if (button.dataset.pythonAction === "run") runPreferredPython(button);
  else if (button.dataset.pythonAction === "reset") resetBrowserPython();
});
