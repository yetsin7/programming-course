# Programming Course

Curso interactivo de Python con dos modos de ejecución.

## Aplicación de escritorio: Python instalado en tu laptop

Este es el modo recomendado en Windows. La aplicación Electron busca y prueba automáticamente:

1. `.venv\\Scripts\\python.exe` o `venv\\Scripts\\python.exe` si existen.
2. `py -3`.
3. `python`.
4. `python3`.

Solo se selecciona un intérprete que responda correctamente a una prueba real. Las celdas usan ese Python local, por lo que pueden aprovechar módulos y capacidades del intérprete instalado.

```powershell
Set-Location C:\Dev\programming-course
pnpm install
pnpm start
```

La instalación de dependencias solo es necesaria la primera vez o cuando cambie `package.json`.

## Navegador: Pyodide

Si no quieres Electron, sirve el curso por HTTP:

```powershell
Set-Location C:\Dev\programming-course
pnpm web
```

Se abrirá `http://127.0.0.1:4173`. En este modo las celdas usan Pyodide y la primera ejecución necesita internet para descargar el intérprete.

No abras `index.html` directamente desde el Explorador de Windows. Una URL `file://` tiene origen `null` y Chromium bloquea el Web Worker utilizado por Pyodide.

## Actualizar el proyecto

```powershell
git pull origin main
pnpm install
pnpm start
```

## Comprobar los archivos JavaScript

```powershell
pnpm check
```

La ejecución de una celda tiene un límite de 15 segundos y un límite de salida para evitar procesos accidentales que bloqueen la aplicación.
