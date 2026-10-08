# Programming Course

An offline, practice-first Python course for a complete beginner using Windows.
Learner-facing lessons and interface strings live in `locales/es/`. Source code,
identifiers, docstrings, filenames, and technical documentation use English.

## Start

Open `index.html` in a modern browser. No server, account, payment, or internet
connection is required to read the course. Start at lesson 01 and follow the
numbered route. Python 3.13 is the tested baseline for runnable examples.

```powershell
Set-Location C:\Dev\programming-course
python examples/01-first-program.py
```

The web reader explains setup, study habits, commands, projects, assessments,
and the graduation rubric in Spanish. Do not inspect exercise solutions before
making a recorded attempt. Browser progress is local to the browser and this
file's location; use the reader's export/import controls to back it up.

## Layout

- `locales/es/lessons/`: authored lesson content and delayed exercise answers.
- `locales/es/projects/`: project specifications, milestones and acceptance cases.
- `locales/es/study-plan.json`: schedule, study habits and troubleshooting.
- `examples/`: runnable, self-contained examples for the numbered lessons.
- `practice/`: editable exercise starters; incomplete bodies are intentional.
- `solutions/`: completed reference implementations, separate from starters.
- `projects/`: project briefs in the reader and runnable reference projects.
- `assets/`: course reader styles, scripts, and generated offline content.
- `scripts/`: build and verification commands.
- `build/`: verification evidence, isolated dependency environments, and reports.

## Verification

```powershell
python scripts/build-course.py
python scripts/verify-course.py
python scripts/check-practice.py --reference
python scripts/check-practice.py --exercise 01
```

The first three commands verify the delivered reference materials. The last
command checks the learner's first exercise and initially fails until completed.
Run `python scripts/check-practice.py --help` for available options.

The final web API requires third-party dependencies. Its README and lesson 27
describe an isolated environment; earlier lessons use the standard library.
Dependency locks record the tested release set, not an assertion that those
versions will remain current indefinitely.

After installing the API dependencies, include that project in full validation:

```powershell
python scripts/verify-course.py --api-python projects/05-task-api/build/api-env/Scripts/python.exe
```

## Scope

The curriculum progresses from first instructions to independently building,
testing, reviewing, and operating a small application. Graduation is based on
demonstrated skills and an independently adapted final project, not reading
completion. Professional expertise continues through real projects, feedback,
and maintenance; this course does not promise employment or expertise by a date.

The reference API is a local, unauthenticated learning application. The reader
includes a production hardening and deployment lab; no public deployment is
performed by installing or running this course.

All lesson explanations and exercises are original. Official references are
linked in the reader for further reading and API verification.

Test modules use unittest's required importable `test_*.py` naming convention;
all other authored multiword filenames use kebab-case. `Dockerfile` retains
Docker's conventional required build filename.
