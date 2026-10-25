"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const EXECUTION_TIMEOUT_MS = 15000;
let staticServer = null;
let appOrigin = null;
let cachedPython = undefined;

function interpreterCandidates() {
  const candidates = [];
  const add = (command, prefix = [], label = command) => {
    if (!command) return;
    const key = command + "\u0000" + prefix.join("\u0000");
    if (!candidates.some((candidate) => candidate.key === key)) candidates.push({ key, command, prefix, label });
  };

  if (process.env.COURSE_PYTHON) add(process.env.COURSE_PYTHON, [], "COURSE_PYTHON");

  const virtualEnvironmentExecutables = process.platform === "win32"
    ? [path.join(ROOT, ".venv", "Scripts", "python.exe"), path.join(ROOT, "venv", "Scripts", "python.exe")]
    : [path.join(ROOT, ".venv", "bin", "python"), path.join(ROOT, "venv", "bin", "python")];
  for (const executable of virtualEnvironmentExecutables) {
    if (fs.existsSync(executable)) add(executable, [], "entorno virtual del curso");
  }

  if (process.platform === "win32") {
    add("py", ["-3"], "Python Launcher (py -3)");
    add("python", [], "python");
    add("python3", [], "python3");
  } else {
    add("python3", [], "python3");
    add("python", [], "python");
  }
  return candidates;
}

function probeInterpreter(candidate) {
  const result = spawnSync(candidate.command, [
    ...candidate.prefix,
    "-c",
    "import json,sys; print(json.dumps({'executable': sys.executable, 'version': sys.version.split()[0]}))"
  ], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 4000,
    windowsHide: true,
    shell: false
  });
  if (result.error || result.status !== 0) return null;
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try {
    const metadata = JSON.parse(lines.at(-1));
    if (!metadata.version || !metadata.executable) return null;
    return {
      available: true,
      command: candidate.command,
      prefix: candidate.prefix,
      label: candidate.label,
      executable: metadata.executable,
      version: metadata.version
    };
  } catch (_error) {
    return null;
  }
}

function detectPython(force = false) {
  if (!force && cachedPython !== undefined) return cachedPython;
  for (const candidate of interpreterCandidates()) {
    const detected = probeInterpreter(candidate);
    if (detected) {
      cachedPython = detected;
      return detected;
    }
  }
  cachedPython = { available: false, error: "No se encontró un intérprete de Python utilizable en este equipo." };
  return cachedPython;
}

function publicPythonInfo(info) {
  if (!info.available) return info;
  return {
    available: true,
    label: info.label,
    executable: info.executable,
    version: info.version
  };
}

function pythonRunner(code, filename) {
  const encoded = Buffer.from(code, "utf8").toString("base64");
  const safeFilename = JSON.stringify(filename || "interactive.py");
  return [
    "import base64",
    `_source = base64.b64decode(${JSON.stringify(encoded)}).decode('utf-8')`,
    `_filename = ${safeFilename}`,
    "_globals = {'__name__': '__main__', '__file__': _filename}",
    "exec(compile(_source, _filename, 'exec'), _globals, _globals)"
  ].join("\n");
}

function runPython(request) {
  return new Promise((resolve) => {
    const code = typeof request?.code === "string" ? request.code : "";
    const input = typeof request?.input === "string" ? request.input : "";
    const filename = typeof request?.filename === "string" ? request.filename : "interactive.py";
    if (!code.trim()) return resolve({ ok: false, error: "No hay código Python para ejecutar." });
    if (code.length > 100000 || input.length > 100000) {
      return resolve({ ok: false, error: "El código o la entrada son demasiado grandes para el editor del curso." });
    }

    const python = detectPython();
    if (!python.available) return resolve({ ok: false, unavailable: true, error: python.error });

    const child = spawn(python.command, [...python.prefix, "-c", pythonRunner(code, filename)], {
      cwd: ROOT,
      windowsHide: true,
      shell: false,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timedOut = false;
    let timer = null;

    const finish = (payload) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      resolve(payload);
    };
    const append = (kind, chunk) => {
      const text = chunk.toString("utf8");
      if (kind === "stdout") stdout += text;
      else stderr += text;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
        stderr += "\n⏹ Ejecución detenida: la salida superó 2 MB.";
        child.kill();
      }
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => finish({ ok: false, error: error.message, stdout, stderr }));
    child.on("close", (exitCode, signal) => finish({
      ok: exitCode === 0 && !timedOut,
      exitCode,
      signal,
      timedOut,
      stdout,
      stderr,
      python: publicPythonInfo(python)
    }));

    timer = setTimeout(() => {
      timedOut = true;
      stderr += "\n⏹ Ejecución detenida tras 15 segundos; revisa si hay un ciclo que no termina.";
      child.kill();
    }, EXECUTION_TIMEOUT_MS);

    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function mimeType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".py": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    staticServer = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
        const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
        const requestedPath = path.resolve(ROOT, "." + pathname);
        if (requestedPath !== ROOT && !requestedPath.startsWith(ROOT + path.sep)) {
          response.writeHead(403).end("Forbidden");
          return;
        }
        fs.stat(requestedPath, (statError, stat) => {
          if (statError || !stat.isFile()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
            return;
          }
          response.writeHead(200, {
            "Content-Type": mimeType(requestedPath),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          });
          fs.createReadStream(requestedPath).pipe(response);
        });
      } catch (error) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(error.message);
      }
    });
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", () => {
      const address = staticServer.address();
      appOrigin = `http://127.0.0.1:${address.port}`;
      resolve(appOrigin);
    });
  });
}

async function createWindow() {
  if (!appOrigin) await startStaticServer();
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: "#f7f8f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(appOrigin)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  await window.loadURL(appOrigin + "/index.html");
}

ipcMain.handle("python:detect", () => publicPythonInfo(detectPython(true)));
ipcMain.handle("python:run", (_event, request) => runPython(request));

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (staticServer) staticServer.close();
});
