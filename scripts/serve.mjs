import { createServer } from "node:http";
import { createReadStream, existsSync, stat } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 4173;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const EXECUTION_TIMEOUT_MS = 15000;
let cachedPython;

function interpreterCandidates() {
  const candidates = [];
  const add = (command, prefix = [], label = command) => {
    if (!command) return;
    const key = command + "\u0000" + prefix.join("\u0000");
    if (!candidates.some((candidate) => candidate.key === key)) candidates.push({ key, command, prefix, label });
  };
  if (process.env.COURSE_PYTHON) add(process.env.COURSE_PYTHON, [], "COURSE_PYTHON");

  const virtualExecutables = process.platform === "win32"
    ? [path.join(ROOT, ".venv", "Scripts", "python.exe"), path.join(ROOT, "venv", "Scripts", "python.exe")]
    : [path.join(ROOT, ".venv", "bin", "python"), path.join(ROOT, "venv", "bin", "python")];
  for (const executable of virtualExecutables) {
    if (existsSync(executable)) add(executable, [], "entorno virtual del curso");
  }

  if (process.platform === "win32") {
    add("py", ["-3"], "Python Launcher (py -3)");
    add("python");
    add("python3");
  } else {
    add("python3");
    add("python");
  }
  return candidates;
}

function probeInterpreter(candidate) {
  const result = spawnSync(candidate.command, [
    ...candidate.prefix,
    "-c",
    "import json,sys; print(json.dumps({'executable': sys.executable, 'version': sys.version.split()[0]}))"
  ], { cwd: ROOT, encoding: "utf8", timeout: 4000, windowsHide: true, shell: false });
  if (result.error || result.status !== 0) return null;
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try {
    const metadata = JSON.parse(lines.at(-1));
    if (!metadata.executable || !metadata.version) return null;
    return { available: true, command: candidate.command, prefix: candidate.prefix, label: candidate.label,
      executable: metadata.executable, version: metadata.version };
  } catch (_error) {
    return null;
  }
}

function detectPython(force = false) {
  if (!force && cachedPython !== undefined) return cachedPython;
  for (const candidate of interpreterCandidates()) {
    const detected = probeInterpreter(candidate);
    if (detected) return (cachedPython = detected);
  }
  return (cachedPython = { available: false, error: "No se encontró un intérprete de Python utilizable." });
}

function publicPythonInfo(info) {
  if (!info.available) return info;
  return { available: true, label: info.label, executable: info.executable, version: info.version };
}

function pythonRunner(code, filename) {
  const encoded = Buffer.from(code, "utf8").toString("base64");
  return [
    "import base64",
    `_source = base64.b64decode(${JSON.stringify(encoded)}).decode('utf-8')`,
    `_filename = ${JSON.stringify(filename || "interactive.py")}`,
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
      return resolve({ ok: false, error: "El código o la entrada son demasiado grandes." });
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
      if (kind === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
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
      exitCode, signal, timedOut, stdout, stderr, python: publicPythonInfo(python)
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

function json(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function validLocalOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  return origin === `http://${request.headers.host}`;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 250000) request.destroy();
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function mimeType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".py": "text/plain; charset=utf-8"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function openBrowser(url) {
  try {
    let child;
    if (process.platform === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
    } else if (process.platform === "darwin") {
      child = spawn("open", [url], { detached: true, stdio: "ignore" });
    } else {
      child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    }
    child.unref();
  } catch (_error) {
    // The address is printed below even if automatic opening is unavailable.
  }
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);

    if (requestUrl.pathname === "/api/python/detect" && request.method === "GET") {
      if (!validLocalOrigin(request)) return json(response, 403, { error: "Origen no permitido." });
      return json(response, 200, publicPythonInfo(detectPython(true)));
    }

    if (requestUrl.pathname === "/api/python/run" && request.method === "POST") {
      if (!validLocalOrigin(request)) return json(response, 403, { error: "Origen no permitido." });
      if (!String(request.headers["content-type"] || "").startsWith("application/json")) {
        return json(response, 415, { error: "Se requiere application/json." });
      }
      const result = await runPython(await readJson(request));
      return json(response, 200, result);
    }

    const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const requestedPath = path.resolve(ROOT, "." + pathname);
    if (requestedPath !== ROOT && !requestedPath.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    stat(requestedPath, (error, info) => {
      if (error || !info.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeType(requestedPath),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      createReadStream(requestedPath).pipe(response);
    });
  } catch (error) {
    json(response, 500, { error: error.message || String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Curso disponible en ${url}`);
  console.log("Las celdas intentarán usar primero el Python instalado y caerán a Pyodide si no hay uno disponible.");
  openBrowser(url);
});
