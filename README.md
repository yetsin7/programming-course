# Programming Course

Two independent, static Python courses in Spanish for absolute beginners. Each
course lives in its own folder and works on its own; neither loads files from
the other.

| Folder | Audience | Entry point |
| --- | --- | --- |
| [`python/`](python/) | Teenagers and adults | `python/index.html` |
| [`python-for-children/`](python-for-children/) | Children from about 8 years old, with an adult nearby | `python-for-children/index.html` |

The root `index.html` is only a chooser page that links to both courses.

## Repository layout

```text
programming-course/
├── index.html               Chooser page (also forwards old lesson links)
├── package.json             JavaScript checks for both courses
├── python/                  Adult course
│   ├── index.html           Offline reader
│   ├── assets/              Reader code, styles and the generated bundle
│   ├── locales/es/          Lesson, project and guide sources (edit these)
│   ├── examples/            One runnable program per lesson
│   ├── practice/            Starter files for checkable exercises
│   ├── solutions/           Reference solutions
│   ├── projects/            Five reference projects with tests
│   └── scripts/             Build and verification scripts
└── python-for-children/     Child course ("Club Python")
    ├── index.html           Mission reader
    ├── lessons.js           Missions 1–12
    ├── advanced-lessons.js  Missions 13–32
    ├── guide-basics.js      Line-by-line guide for missions 1–12
    ├── guide-advanced.js    Line-by-line guide for missions 13–32
    ├── setup-guide.js       "Prepara tu nave" preparation guide
    └── check-content.js     Content completeness check
```

## What each course teaches a complete beginner

Both courses assume the learner only knows how to switch the computer on.

- **Setup guide first.** The adult course has "Empieza aquí" and the child
  course has "Prepara tu nave". They explain files and folders, the keyboard
  symbols used in code, installing Python, and writing, saving and running a
  first program with IDLE.
- **Plain words before technical words.** Every adult lesson opens with an
  everyday analogy ("En palabras simples") and a short vocabulary list. Every
  child mission lists its new words with their meaning, including the English
  keywords.
- **Code read line by line.** Child missions explain each revealed line of the
  example and show exactly what appears on screen. Adult lessons show the
  command to run the full example and its exact expected output.
- **Help when something fails.** Each child mission ends with the most common
  mistake and its fix. The adult setup guide explains how to read the usual
  Python error messages.

## Open the courses

Use the published GitHub Pages site, or open `index.html` in a browser and
choose a course. No application server, account or network access is needed.
Progress is stored in the browser, separately for each course.

## Development checks

After editing files under `python/locales/es/`, rebuild the adult bundle:

```powershell
python python/scripts/build-course.py
```

Before publishing, run every check:

```powershell
pnpm install
pnpm check
python python/scripts/verify-course.py
```

`pnpm check` validates JavaScript syntax for both courses and runs
`python-for-children/check-content.js`, which requires every mission to have
vocabulary, one explanation per code line, an expected output and a
troubleshooting tip. `verify-course.py` runs the 32 adult examples and compares
their output exactly, checks the beginner notes and setup guide, and runs the
project tests. Its report is written to `python/build/verification.json`.

Learner-facing text and teaching comments are in Spanish. Python identifiers,
technical diagnostics and implementation documentation remain in English.
