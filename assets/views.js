/** Compose the overview, project briefs and supporting study pages. */
"use strict";

/** Render a clear first action and the staged learning route. */
function homeMarkup() {
  const upcoming = nextLesson();
  let markup = '<section class="hero"><p class="eyebrow">' + escapeHtml(COURSE.subtitle) +
    '</p><h1 tabindex="-1">' + escapeHtml(COURSE.title) + '</h1><p class="hero-description">' +
    escapeHtml(COURSE.description) + '</p><a class="primary" href="#lesson-' + lessonNumber(upcoming.id) +
    '">' + escapeHtml(translate(learnerProgress.completed.length ? "resume" : "start")) +
    ' <span aria-hidden="true">→</span></a><div class="course-stats">';
  for (const [count, key] of [[32, "statsLessons"], [96, "statsExercises"], [5, "statsProjects"]]) {
    markup += "<div><strong>" + count + "</strong><span>" + escapeHtml(translate(key)) + "</span></div>";
  }
  markup += '</div></section><section class="reader-section"><h2>' + escapeHtml(translate("journey")) +
    '</h2><div class="phase-grid">';
  for (let phase = 0; phase < COURSE.phases.length; phase += 1) {
    const firstId = phase * 4 + 1;
    const lastId = firstId + 3;
    let completed = 0;
    for (let id = firstId; id <= lastId; id += 1) if (learnerProgress.completed.includes(id)) completed += 1;
    markup += '<a class="phase-card" href="#lesson-' + lessonNumber(firstId) + '"><span class="phase-range">' +
      lessonNumber(firstId) + "–" + lessonNumber(lastId) + '</span><h3>' + escapeHtml(COURSE.phases[phase]) +
      '</h3><span class="phase-count">' + completed + " / 4 · " + escapeHtml(translate("completedCount")) + "</span></a>";
  }
  markup += "</div></section>";
  markup += sectionMarkup("Python en tu navegador",
    "<p>Abre cualquier lección para editar y ejecutar su ejemplo sin instalar Python. La primera ejecución necesita internet para descargar el intérprete.</p>" +
    "<p>El editor sirve para practicar y ejecutar ejemplos compatibles. Para entornos virtuales, paquetes de escritorio, archivos locales y servidores del curso necesitarás Python instalado en Windows.</p>",
    "goal-panel");
  markup += sectionMarkup(translate("whyPython"), paragraphsMarkup([COURSE.languageChoice]), "goal-panel");
  markup += sectionMarkup(translate("daily"), listMarkup(COURSE.plan.firstSession, true));
  return markup + '<p class="local-notice">' + escapeHtml(translate("localNotice")) + "</p>";
}

/** Render all projects in their recommended completion order. */
function projectsMarkup() {
  let markup = pageHeading(translate("projects"), translate("referenceReminder")) + '<div class="project-grid">';
  for (const project of COURSE.projects) {
    markup += '<a class="project-card" href="#project-' + project.id + '"><p class="eyebrow">' +
      escapeHtml(translate("projectAfter")) + " " + lessonNumber(project.after) + "</p><h2>" +
      escapeHtml(project.title) + "</h2><p>" + escapeHtml(project.brief) +
      '</p><span class="project-link">' + escapeHtml(translate("openProject")) + " →</span></a>";
  }
  return markup + "</div>";
}

/** Render the specification, commands and acceptance cases of one project. */
function projectMarkup(project) {
  let markup = '<a class="back-link" href="#projects">← ' + escapeHtml(translate("back")) + "</a>" +
    pageHeading(project.title, project.brief) + '<p class="lesson-meta">' + escapeHtml(project.hours) + " " +
    escapeHtml(translate("projectHours")) + " · " + escapeHtml(translate("referencePath")) +
    ": <code>" + escapeHtml(project.path) + "</code></p>";
  markup += sectionMarkup(translate("milestones"), listMarkup(project.milestones, true));
  markup += sectionMarkup(translate("deliverables"), listMarkup(project.deliverables), "goal-panel");
  markup += sectionMarkup(translate("acceptance"), listMarkup(project.acceptance));
  let commands = '<p class="muted">' + escapeHtml(translate("referenceReminder")) + "</p>";
  for (const command of project.commands) commands += commandMarkup(command);
  markup += sectionMarkup(translate("projectCommands"), commands);
  return markup + sectionMarkup(translate("extensions"), listMarkup(project.extensions));
}

/** Render a realistic schedule with recall, review and concrete troubleshooting. */
function planMarkup() {
  const plan = COURSE.plan;
  let markup = pageHeading(plan.title, plan.intro) +
    sectionMarkup(translate("schedule"), paragraphsMarkup([plan.schedule]), "goal-panel");
  markup += sectionMarkup(translate("daily"), listMarkup(plan.firstSession, true));
  markup += sectionMarkup(translate("session"), listMarkup(plan.session, true));
  markup += sectionMarkup(translate("recall"), paragraphsMarkup([plan.review]));
  markup += sectionMarkup(translate("checkpoints"), definitionsMarkup(plan.checkpoints));
  markup += sectionMarkup(translate("studyRules"), listMarkup(plan.rules));
  markup += sectionMarkup(translate("askingHelp"), paragraphsMarkup([plan.help]));
  return markup + sectionMarkup(translate("troubleshooting"), definitionsMarkup(plan.troubleshooting));
}

/** Render a capability-based graduation rubric rather than a time-based promise. */
function graduationMarkup() {
  const graduation = COURSE.graduation;
  return pageHeading(translate("graduation"), graduation.intro) +
    sectionMarkup(translate("rubric"), definitionsMarkup(graduation.criteria)) +
    sectionMarkup(translate("evaluation"), paragraphsMarkup([graduation.scoring]), "goal-panel") +
    sectionMarkup(translate("nextSpecialty"), paragraphsMarkup([graduation.next]));
}
