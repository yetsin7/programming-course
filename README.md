# Programming Course

This repository contains two static Python courses:

- The adult course starts at `index.html` and includes 32 lessons, exercises,
  projects, and progress tracking.
- The child course starts at `python-for-children/index.html` and includes 32
  guided missions with age-appropriate examples and questions.

## Open the courses

Use the published GitHub Pages site or open either HTML entry point directly in
a browser. No application server, Electron runtime, or in-browser Python console
is required.

## Practice the exercises

The lessons show short teaching excerpts, not complete programs to copy. Read
each line, predict what it does, and write your own solution in a `.py` file
using VS Code or another text editor. Run your file from the editor's integrated
terminal, PowerShell, or Command Prompt:

```powershell
python path\to\exercise.py
```

If `python` is not available on Windows, try `py` or install Python from
[python.org](https://www.python.org/downloads/).

## Development checks

Rebuild the localized adult-course bundle after editing files under
`locales/es/`:

```powershell
python scripts/build-course.py
```

Run the JavaScript and Python validation checks before publishing:

```powershell
pnpm install
pnpm check
python scripts/verify-course.py
```

The learner-facing explanations and teaching comments are in Spanish. Python
identifiers, technical diagnostics, and implementation documentation remain in
English.
