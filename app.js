/* No dependencies or build step. Works at a GitHub Pages subpath or via file://. */
(() => {
  "use strict";
  const { species, causes, questions, reviewed } = ECHOES_DATA;
  const byId = new Map(species.map((item) => [item.id, item]));
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const storageKey = "echoes-of-extinction:saved:v1";
  const grid = $("#species-grid");
  const search = $("#species-search");
  const sort = $("#species-sort");
  const dialog = $("#story-dialog");
  const content = $("#dialog-content");
  let saved = readSaved();
  let filter = "all";
  let dialogReturnFocus = null;
  let toastTimer;
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(
        Array.isArray(value) ? value.filter((id) => byId.has(id)) : [],
      );
    } catch {
      return new Set();
    }
  }

  function bookmarkSVG() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  function art(item, lazy = true) {
    return `<div class="species-image standard ${item.id}" style="--image-position: ${item.imagePosition}; --image-fit: ${item.imageFit}; --image-background: ${item.imageBackground}"><img src="${item.image}" alt="${escapeHTML(item.alt)}" width="${item.imageWidth}" height="${item.imageHeight}" loading="${lazy ? "lazy" : "eager"}" decoding="async"></div>`;
  }

  function badge(item) {
    return `<span class="status-badge ${item.status}${item.conservation === "Critically endangered" ? " critical" : ""}"><span class="status-dot" aria-hidden="true"></span>${escapeHTML(item.conservation)}</span>`;
  }


  function updateCollectionCounts() {
    const extinct = species.filter((item) => item.status === "extinct").length;
    const endangered = species.filter(
      (item) => item.status === "endangered",
    ).length;
    $("#intro-total").textContent = String(species.length).padStart(2, "0");
    $("#intro-extinct").textContent = String(extinct).padStart(2, "0");
    $("#intro-living").textContent = String(endangered).padStart(2, "0");
    $("#all-filter-count").textContent = species.length;
    $("#extinct-filter-count").textContent = extinct;
    $("#endangered-filter-count").textContent = endangered;
  }

  function filteredSpecies() {
    const query = search.value.trim().toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    let items = species.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "saved" ? saved.has(item.id) : item.status === filter);
      const haystack = [
        item.name,
        item.scientific,
        item.place,
        item.range,
        item.summary,
        item.status,
        item.conservation,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return matchesFilter && words.every((word) => haystack.includes(word));
    });
    if (sort.value === "name")
      items = items.toSorted
        ? items.toSorted((a, b) => a.name.localeCompare(b.name))
        : [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }

  function renderArchive() {
    const items = filteredSpecies();
    grid.innerHTML = items
      .map(
        (item) => `
      <article class="species-card" data-card="${item.id}">
        <div class="species-visual">
          ${art(item)}${badge(item)}
          <button class="visual-story-button" data-species="${item.id}" aria-label="Read the story of ${escapeHTML(item.name)}"></button>
          <button class="bookmark" data-save="${item.id}" aria-pressed="${saved.has(item.id)}" aria-label="${saved.has(item.id) ? "Remove" : "Save"} ${escapeHTML(item.name)}${saved.has(item.id) ? " from" : " to"} field notes">${bookmarkSVG()}</button>
        </div>
        <div class="card-body"><p class="card-place"><span>${escapeHTML(item.place)}</span><span>${item.number}</span></p><h3 class="species-name">${escapeHTML(item.name)}</h3><p class="card-description">${escapeHTML(item.summary)}</p><div class="card-bottom"><span>${escapeHTML(item.date)}</span><button class="story-link" data-species="${item.id}">Read story <span aria-hidden="true">↗</span></button></div></div>
      </article>`,
      )
      .join("");
    $("#result-count").textContent =
      `${items.length} ${items.length === 1 ? "story" : "stories"} to discover`;
    $("#empty-state").hidden = items.length > 0;
    const emptySaved = filter === "saved" && saved.size === 0;
    $("#empty-title").textContent = emptySaved
      ? "Your field notes start here."
      : "No species found.";
    $("#empty-description").textContent = emptySaved
      ? "Save a species with its bookmark button, then return to your collection."
      : "Try another name, place, or a different filter.";
    updateSavedControls();
  }

  function updateSavedControls() {
    $("#saved-count").textContent = saved.size;
    $("#saved-filter-count").textContent = saved.size;
    $("#show-saved").setAttribute(
      "aria-label",
      `View saved species, ${saved.size} saved`,
    );
    $$("[data-save]").forEach((button) => {
      const item = byId.get(button.dataset.save);
      const isSaved = saved.has(item.id);
      button.setAttribute("aria-pressed", String(isSaved));
      button.setAttribute(
        "aria-label",
        `${isSaved ? "Remove" : "Save"} ${item.name}${isSaved ? " from" : " to"} field notes`,
      );
      if (button.classList.contains("dialog-save")) {
        button.innerHTML = `${bookmarkSVG()} ${isSaved ? "Saved to field notes" : "Save to field notes"}`;
      }
    });
  }

  function syncURL() {
    try {
      const url = new URL(location.href);
      const query = search.value.trim();
      if (filter === "all") url.searchParams.delete("status");
      else url.searchParams.set("status", filter);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      if (sort.value === "name") url.searchParams.set("sort", "name");
      else url.searchParams.delete("sort");
      history.replaceState(null, "", url);
    } catch {
      /* Local file previews may limit History API usage. */
    }
  }

  function setFilter(next, scroll = false, resetSearch = false) {
    filter = ["all", "extinct", "endangered", "saved"].includes(next)
      ? next
      : "all";
    if (resetSearch) search.value = "";
    $$(".filter").forEach((button) => {
      const isActive = button.dataset.filter === filter;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    renderArchive();
    syncURL();
    if (scroll) {
      $("#archive").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function toggleSaved(id, trigger) {
    const item = byId.get(id);
    if (!item) return;
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    let persistent = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...saved]));
    } catch {
      persistent = false;
    }
    const wasInGrid = trigger && grid.contains(trigger);
    if (filter === "saved") {
      renderArchive();
      if (wasInGrid)
        (grid.querySelector(".bookmark") || $("#reset-filters")).focus({
          preventScroll: true,
        });
    } else updateSavedControls();
    showToast(
      `${item.name} ${saved.has(id) ? "saved to" : "removed from"} your field notes.${persistent ? "" : " Saved for this visit only."}`,
    );
  }

  function showDialog() {
    dialogReturnFocus = document.activeElement;
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add("dialog-open");
    $("#dialog-close").focus({ preventScroll: true });
  }

  function openStory(id) {
    const item = byId.get(id);
    if (!item) return;
    content.innerHTML = `<div class="dialog-hero">${art(item, false)}</div><div class="dialog-body">${badge(item)}<h2 id="dialog-title">${escapeHTML(item.name)}</h2><p class="scientific-name">${escapeHTML(item.scientific)}</p><dl class="dialog-facts"><div><dt>${item.status === "extinct" ? "Where it lived" : "Where it lives"}</dt><dd>${escapeHTML(item.range)}</dd></div><div><dt>${item.status === "extinct" ? "When it disappeared" : "Conservation status"}</dt><dd>${escapeHTML(item.dateDetail)}</dd></div></dl><div class="dialog-story">${item.paragraphs.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("")}</div><aside class="evidence-note"><strong>A note on the evidence</strong>${escapeHTML(item.evidence)}</aside><div class="dialog-actions"><button class="button button-green dialog-save" data-save="${item.id}" aria-pressed="${saved.has(item.id)}">${bookmarkSVG()} Save to field notes</button></div></div>`;
    updateSavedControls();
    if (!dialog.open) showDialog();
    else dialog.scrollTop = 0;
  }

  function openSources() {
    content.innerHTML = `<div class="dialog-body sources-body"><p class="eyebrow">About this archive</p><h2 id="dialog-title">About the project</h2><p>Echoes of Extinction is an independent educational wildlife archive. The animal illustrations were newly generated for this edition and are artistic interpretations, not documentary photographs.</p><h3>Scientific context</h3><p>Species profiles summarize published conservation and natural-history information. Dates and causes may be uncertain; please consult primary research for academic work.</p><h3>Artwork note</h3><p>The animal collection uses new generated images. Other decorative landscapes and graphics were retained from the original project, and their provenance has not been independently established.</p></div>`;
    if (!dialog.open) showDialog();
    else dialog.scrollTop = 0;
  }

  function selectTimeline(id, focus = false) {
    const item = byId.get(id);
    if (!item) return;
    $$(".timeline-tab").forEach((button) => {
      const selected = button.dataset.time === id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    const panel = $("#timeline-panel");
    panel.setAttribute("aria-labelledby", `time-${id}`);
    panel.innerHTML = `<div class="timeline-art">${art(item)}</div><div class="timeline-copy"><p class="eyebrow">${escapeHTML(item.date)} · ${escapeHTML(item.place)}</p><h3>${escapeHTML(item.timelineTitle)}</h3><p>${escapeHTML(item.timelineText)}</p><button class="story-link" data-species="${id}">Open the full story <span aria-hidden="true">↗</span></button></div>`;
  }

  function selectCause(id, focus = false) {
    const cause = causes[id];
    if (!cause) return;
    $$(".cause-tab").forEach((button) => {
      const selected = button.dataset.cause === id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    const panel = $("#cause-panel");
    panel.setAttribute("aria-labelledby", `cause-${id}`);
    panel.innerHTML = `<img class="cause-background" src="${cause.image}" alt="" loading="lazy"><div class="cause-shade" aria-hidden="true"></div><div class="cause-content"><p class="eyebrow">Driver ${cause.number} / Modern biodiversity loss</p><h3>${escapeHTML(cause.title)}</h3><p>${escapeHTML(cause.description)}</p><p class="cause-action">${escapeHTML(cause.action)}</p></div>`;
  }

  function handleTabKeys(event, selector, dataKey, select) {
    const tabs = $$(selector);
    const vertical =
      tabs[0].parentElement.getAttribute("aria-orientation") === "vertical";
    const previous = vertical ? "ArrowUp" : "ArrowLeft";
    const next = vertical ? "ArrowDown" : "ArrowRight";
    if (![previous, next, "Home", "End"].includes(event.key)) return;
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const newIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === next ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[newIndex].dataset[dataKey], true);
  }

  function renderQuiz(moveFocus = false) {
    const panel = $("#quiz-panel");
    quizAnswered = false;
    if (quizIndex >= questions.length) {
      panel.innerHTML = `<p class="quiz-top">Field test complete <span aria-hidden="true">✳</span></p><p class="quiz-score">${quizScore}<span style="font-size:24px"> / ${questions.length}</span></p><h3>${quizScore === questions.length ? "A curious mind, well travelled." : "Every question opens a new story."}</h3><p class="quiz-summary">${quizScore === questions.length ? "You know your way around the collection. Keep exploring." : "Return to the species stories, then take another look."}</p><button class="button button-green" id="quiz-restart">Try the field test again <span aria-hidden="true">↗</span></button>`;
      if (moveFocus) $("#quiz-restart").focus({ preventScroll: true });
      return;
    }
    const question = questions[quizIndex];
    panel.innerHTML = `<div class="quiz-top"><span>Question ${quizIndex + 1} of ${questions.length}</span><div class="quiz-progress" aria-hidden="true">${questions.map((_, index) => `<span class="${index <= quizIndex ? "active" : ""}"></span>`).join("")}</div></div><h3 id="quiz-question">${escapeHTML(question.question)}</h3><div class="quiz-options" role="group" aria-labelledby="quiz-question">${question.options.map((option, index) => `<button class="quiz-option" data-answer="${index}"><span aria-hidden="true">${String.fromCharCode(65 + index)}</span><span>${escapeHTML(option)}</span></button>`).join("")}</div><p class="quiz-feedback" id="quiz-feedback" hidden></p><button class="button button-green quiz-next" id="quiz-next" hidden>${quizIndex === questions.length - 1 ? "See your result" : "Next question"} <span aria-hidden="true">↗</span></button>`;
    if (moveFocus)
      panel.querySelector(".quiz-option").focus({ preventScroll: true });
  }

  function answerQuiz(answer) {
    if (quizAnswered || quizIndex >= questions.length) return;
    quizAnswered = true;
    const question = questions[quizIndex];
    const correct = answer === question.correct;
    if (correct) quizScore++;
    $$(".quiz-option").forEach((button) => {
      const index = Number(button.dataset.answer);
      button.disabled = true;
      button.classList.toggle("correct", index === question.correct);
      button.classList.toggle("incorrect", index === answer && !correct);
    });
    const feedback = $("#quiz-feedback");
    feedback.textContent = `${correct ? "Correct." : `The answer is ${question.options[question.correct]}.`} ${question.explanation}`;
    feedback.hidden = false;
    $("#quiz-next").hidden = false;
    $("#quiz-next").focus({ preventScroll: true });
  }

  function closeMenu(restoreFocus = false) {
    const toggle = $("#menu-toggle");
    $("#mobile-nav").hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
    if (restoreFocus) toggle.focus();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.species) openStory(button.dataset.species);
    else if (button.dataset.save) toggleSaved(button.dataset.save, button);
    else if (button.dataset.filter) setFilter(button.dataset.filter);
    else if (button.dataset.time) selectTimeline(button.dataset.time);
    else if (button.dataset.cause) selectCause(button.dataset.cause);
    else if (button.dataset.answer !== undefined)
      answerQuiz(Number(button.dataset.answer));
    else if (button.id === "quiz-next" && quizAnswered) {
      quizIndex++;
      renderQuiz(true);
    } else if (button.id === "quiz-restart") {
      quizIndex = 0;
      quizScore = 0;
      renderQuiz(true);
    }
  });

  search.addEventListener("input", () => {
    renderArchive();
    syncURL();
  });
  sort.addEventListener("change", () => {
    renderArchive();
    syncURL();
  });
  $("#show-saved").addEventListener("click", () =>
    setFilter("saved", true, true),
  );
  $("#explore-endangered").addEventListener("click", () =>
    setFilter("endangered", true, true),
  );
  $("#reset-filters").addEventListener("click", () => {
    setFilter("all", false, true);
    search.focus({ preventScroll: true });
  });
  $("#show-sources").addEventListener("click", openSources);
  $("#dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (dialogReturnFocus && document.contains(dialogReturnFocus))
      dialogReturnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  $("#menu-toggle").addEventListener("click", () => {
    const toggle = $("#menu-toggle");
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    $("#mobile-nav").hidden = expanded;
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.setAttribute(
      "aria-label",
      expanded ? "Open navigation menu" : "Close navigation menu",
    );
  });
  $$("#mobile-nav a").forEach((link) =>
    link.addEventListener("click", () => closeMenu()),
  );
  document.addEventListener("keydown", (event) => {
    const isTyping = event.target.closest(
      "input,textarea,select,[contenteditable=true]",
    );
    if (
      event.key === "/" &&
      !isTyping &&
      !dialog.open &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      $("#archive").scrollIntoView();
      search.focus({ preventScroll: true });
    }
    if (event.key === "Escape" && !$("#mobile-nav").hidden) closeMenu(true);
    handleTabKeys(event, ".timeline-tab", "time", selectTimeline);
    handleTabKeys(event, ".cause-tab", "cause", selectCause);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      saved = readSaved();
      renderArchive();
    }
  });
  window
    .matchMedia("(min-width: 651px)")
    .addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });
  let scrollFrame = false;
  function updateProgress() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const percent =
      total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    $("#reading-progress").style.transform = `scaleX(${percent})`;
    scrollFrame = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) {
        scrollFrame = true;
        requestAnimationFrame(updateProgress);
      }
    },
    { passive: true },
  );
  window.addEventListener("resize", updateProgress);

  const url = new URL(location.href);
  updateCollectionCounts();
  search.value = url.searchParams.get("q") || "";
  if (url.searchParams.get("sort") === "name") sort.value = "name";
  const legacyFilter =
    location.hash === "#extinct"
      ? "extinct"
      : location.hash === "#endangered"
        ? "endangered"
        : null;
  setFilter(url.searchParams.get("status") || legacyFilter || "all");
  selectTimeline("smilodon");
  selectCause("habitat");
  renderQuiz();
  updateProgress();
  if (legacyFilter) $("#archive").scrollIntoView({ behavior: "instant" });
})();
