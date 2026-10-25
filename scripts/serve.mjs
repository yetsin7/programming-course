import { createServer } from "node:http";
import { createReadStream, stat } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 4173;

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

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
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
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(error.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Curso disponible en ${url}`);
  console.log("Este modo usa Pyodide en el navegador. Para usar el Python instalado en tu laptop ejecuta: pnpm start");
  openBrowser(url);
});
