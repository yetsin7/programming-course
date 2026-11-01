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

Students should copy each example into a `.py` file using VS Code or another
text editor. Run the file from the editor's integrated terminal, PowerShell, or
Command Prompt:

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

The learner-facing interface is localized in Spanish. Source identifiers,
technical documentation, comments, and diagnostics remain in English.
