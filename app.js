/* Six Pillars Wellness Journal — local-first journal logic */
(function () {
  "use strict";

  var STORAGE_KEY = "six-pillars-journal-v1";

  var PILLARS = [
    { id: "nourish", n: 1, title: "Nourish", focus: "Healthy, balanced food" },
    { id: "hydrate", n: 2, title: "Hydrate", focus: "Water & body care" },
    { id: "move", n: 3, title: "Move", focus: "Exercise & physical health" },
    { id: "care", n: 4, title: "Care", focus: "Skincare & self-care" },
    { id: "connect", n: 5, title: "Connect", focus: "Salah, Quran & gratitude" },
    { id: "grow", n: 6, title: "Grow", focus: "Learning, skills & productivity" }
  ];

  var HABITS = [
    { id: "nourish", label: "Nourish: balanced food" },
    { id: "stretch", label: "Stretching & active steps" },
    { id: "water", label: "Hydration: water goal" },
    { id: "skincare", label: "Care: morning & PM skincare" },
    { id: "sleep", label: "Restful sleep & self-care" },
    { id: "salah", label: "Connect: five daily Salah" },
    { id: "quran", label: "Quran recitation & gratitude" },
    { id: "focus", label: "Grow: focused learning" },
    { id: "skill", label: "Skill practice & top task" }
  ];

  var BASELINE = [
    { id: "q1", label: "1. How do I currently feel in my body, mind, and daily energy levels?" },
    { id: "q2", label: "2. Which of the six pillars already feels natural, and which needs the gentlest attention?" },
    { id: "q3", label: "3. What distractions or obstacles tend to pull me off routine, and how will I respond with grace?" },
    { id: "q4", label: "4. What would make these twenty-one days feel worthwhile twenty-one days from now?" }
  ];

  var SALAH = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  var WEEK_NAMES = ["", "Week one · Planting the seeds", "Week two · Building the rhythm", "Week three · Becoming the habit"];

  function makeDay() {
    return {
      date: "", mood: "", notes: {}, done: {}, cups: 0,
      skincare: { am: false, pm: false }, salah: {}, quran: "", reflection: ""
    };
  }

  function blankState() {
    var s = { version: 1, commitments: {}, deeperWhy: "", baseline: {}, habits: {}, days: {} };
    PILLARS.forEach(function (p) { s.commitments[p.id] = ""; });
    BASELINE.forEach(function (q) { s.baseline[q.id] = ""; });
    HABITS.forEach(function (h) { s.habits[h.id] = new Array(21).fill(false); });
    for (var d = 1; d <= 21; d++) { s.days[d] = makeDay(); }
    return s;
  }

  function loadState() {
    var fresh = blankState();
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return fresh; }
    if (!raw) return fresh;
    try {
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return fresh;
      Object.keys(fresh.commitments).forEach(function (k) {
        if (typeof saved.commitments === "object" && saved.commitments && typeof saved.commitments[k] === "string") fresh.commitments[k] = saved.commitments[k];
      });
      if (typeof saved.deeperWhy === "string") fresh.deeperWhy = saved.deeperWhy;
      Object.keys(fresh.baseline).forEach(function (k) {
        if (saved.baseline && typeof saved.baseline[k] === "string") fresh.baseline[k] = saved.baseline[k];
      });
      Object.keys(fresh.habits).forEach(function (k) {
        var arr = saved.habits && saved.habits[k];
        if (Array.isArray(arr)) fresh.habits[k] = arr.slice(0, 21).map(function (v) { return v === true; });
      });
      for (var d = 1; d <= 21; d++) {
        var old = saved.days && saved.days[d];
        if (!old || typeof old !== "object") continue;
        var day = fresh.days[d];
        if (typeof old.date === "string") day.date = old.date;
        if (typeof old.mood === "string") day.mood = old.mood;
        if (typeof old.reflection === "string") day.reflection = old.reflection;
        if (typeof old.quran === "string") day.quran = old.quran;
        if (old.notes && typeof old.notes === "object") {
          PILLARS.forEach(function (p) { if (typeof old.notes[p.id] === "string") day.notes[p.id] = old.notes[p.id]; });
        }
        if (old.done && typeof old.done === "object") {
          PILLARS.forEach(function (p) { day.done[p.id] = old.done[p.id] === true; });
        }
        if (typeof old.cups === "number") day.cups = Math.max(0, Math.min(8, old.cups));
        if (old.skincare && typeof old.skincare === "object") {
          day.skincare.am = old.skincare.am === true;
          day.skincare.pm = old.skincare.pm === true;
        }
        if (old.salah && typeof old.salah === "object") {
          SALAH.forEach(function (s) { day.salah[s] = old.salah[s] === true; });
        }
      }
    } catch (e) {
      return fresh;
    }
    return fresh;
  }

  var state = loadState();
  var currentWeek = 1;
  var currentDay = 1;
  var saveTimer = null;
  var $ = function (sel) { return document.querySelector(sel); };

  function setStatus(message, isError) {
    var node = $("#daySaveStatus");
    node.textContent = message;
    node.classList.toggle("is-error", !!isError);
    node.style.color = isError ? "var(--danger)" : "";
  }

  function toast(message) {
    var node = $("#toast");
    node.textContent = message;
    window.setTimeout(function () { node.textContent = ""; }, 4000);
  }

  function persist(showStatus) {
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (showStatus !== false) setStatus("All changes saved", false);
    } catch (e) {
      setStatus("Could not save — browser storage is unavailable.", true);
      toast("Your changes could not be saved. Check browser storage settings and try again.");
      var footer = $(".day-panel-footer");
      var existing = $("#retrySave");
      if (!existing && footer) {
        var btn = document.createElement("button");
        btn.type = "button"; btn.id = "retrySave"; btn.className = "btn btn-ghost btn-sm";
        btn.textContent = "Retry save";
        btn.addEventListener("click", function () { persist(true); });
        footer.insertBefore(btn, footer.firstChild);
      }
    }
    refreshProgress();
  }

  function schedulePersist() {
    setStatus("Saving…", false);
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () { persist(true); }, 250);
  }

  function doneCount(d) {
    return PILLARS.reduce(function (n, p) { return n + (d.done[p.id] ? 1 : 0); }, 0);
  }

  function refreshProgress() {
    var complete = 0, habits = 0, reflections = 0, commitments = 0;
    for (var d = 1; d <= 21; d++) {
      if (doneCount(state.days[d]) === PILLARS.length) complete++;
      if (state.days[d].reflection.trim()) reflections++;
    }
    HABITS.forEach(function (h) {
      state.habits[h.id].forEach(function (v) { if (v) habits++; });
    });
    PILLARS.forEach(function (p) { if (state.commitments[p.id].trim()) commitments++; });

    $("#progressDays").textContent = complete;
    $("#progressFill").style.width = (complete / 21 * 100) + "%";
    $("#progressBar").setAttribute("aria-valuenow", String(complete));
    $("#headerProgress").textContent = complete + " / 21 days";
    $("#statCommitments").textContent = commitments + " / 6";
    $("#statHabits").textContent = habits + " / " + (HABITS.length * 21);
    $("#statReflections").textContent = reflections + " / 21";

    var chip = document.querySelector('.day-chip[data-day="' + currentDay + '"] .chip-progress');
    if (chip) chip.textContent = doneCount(state.days[currentDay]) + "/6";
  }

  function renderPillars() {
    $("#pillarRows").innerHTML = PILLARS.map(function (p) {
      return '<tr><th scope="row">' + p.n + '. ' + p.title + '</th>' +
        '<td>' + p.focus + '</td>' +
        '<td><input type="text" class="commitment-input" data-commit="' + p.id + '"' +
        ' aria-label="Daily non-negotiable commitment for ' + p.title + '"' +
        ' value="' + escapeAttr(state.commitments[p.id]) + '" placeholder="One small promise…"></td></tr>';
    }).join("");
  }

  function renderBaseline() {
    $("#baselinePrompts").innerHTML = BASELINE.map(function (q) {
      return '<div class="prompt-card"><label class="prompt-label" for="baseline-' + q.id + '">' + q.label + '</label>' +
        '<textarea id="baseline-' + q.id + '" data-baseline="' + q.id + '" rows="4">' + escapeText(state.baseline[q.id]) + '</textarea>' +
        '<p class="field-hint">Saved automatically as you type.</p></div>';
    }).join("");
  }

  function renderTracker() {
    var head = '<thead><tr><th scope="col">Habit</th>';
    for (var d = 1; d <= 21; d++) {
      head += '<th scope="col"><button type="button" class="day-head' + (d === currentDay ? ' is-current' : '') +
        '" data-day="' + d + '" aria-label="Open Day ' + d + ' journal log">' + d + '</button></th>';
    }
    head += '</tr></thead>';
    var body = '<tbody>' + HABITS.map(function (h) {
      var cells = '';
      for (var d = 1; d <= 21; d++) {
        var on = state.habits[h.id][d - 1];
        cells += '<td><button type="button" class="habit-dot" data-habit="' + h.id + '" data-day="' + d +
          '" aria-pressed="' + on + '" aria-label="' + h.label + ', day ' + d + '"></button></td>';
      }
      return '<tr><th scope="row">' + h.label + '</th>' + cells + '</tr>';
    }).join('') + '</tbody>';
    $("#trackerTable").innerHTML = '<caption class="visually-hidden">Twenty-one day habit tracker. Select a day number to open that day\'s log.</caption>' + head + body;
  }

  function renderDayStrip() {
    var start = (currentWeek - 1) * 7 + 1;
    var html = '';
    for (var d = start; d < start + 7; d++) {
      var on = d === currentDay;
      html += '<button type="button" class="day-chip" data-day="' + d + '" aria-pressed="' + on + '">' +
        '<span class="chip-day">Day ' + d + '</span>' +
        '<span class="chip-progress">' + doneCount(state.days[d]) + '/6</span></button>';
    }
    $("#dayStrip").innerHTML = html;
  }

  function notesControl(p, day) {
    var value = escapeText(day.notes[p.id] || "");
    var base = '<textarea data-note="' + p.id + '" rows="2" aria-label="Today\'s action / notes for ' + p.title + '">' + value + '</textarea>';
    var extra = '';
    if (p.id === "hydrate") {
      var cups = '';
      for (var i = 1; i <= 8; i++) {
        cups += '<button type="button" class="cup" data-cup="' + i + '" aria-pressed="' + (i <= day.cups) +
          '" aria-label="Cup ' + i + ' of 8"></button>';
      }
      extra = '<span class="check-label" style="display:inline-flex; margin-bottom:6px;">Cups:</span> ' +
        '<span class="cups" role="group" aria-label="Water cups, ' + day.cups + ' of 8">' + cups + '</span><br>';
    } else if (p.id === "care") {
      extra = '<span class="check-row" style="margin-bottom:8px;">' +
        '<label class="check-label"><input type="checkbox" data-skin="am"' + (day.skincare.am ? ' checked' : '') + '> AM Skincare</label>' +
        '<label class="check-label"><input type="checkbox" data-skin="pm"' + (day.skincare.pm ? ' checked' : '') + '> PM Skincare</label></span><br>';
    } else if (p.id === "connect") {
      var salah = SALAH.map(function (s) {
        return '<label class="check-label"><input type="checkbox" data-salah="' + s + '"' + (day.salah[s] ? ' checked' : '') + '> ' + s + '</label>';
      }).join('');
      extra = '<span class="salah-line" style="margin-bottom:8px;">' + salah + '</span> ' +
        '<label class="check-label" for="quranText">Quran:</label> ' +
        '<input type="text" class="quran-field" id="quranText" data-save="quran" aria-label="Quran recitation" value="' + escapeAttr(day.quran) + '" placeholder="Surah / notes"><br>';
    }
    return extra + base;
  }

  function renderLog() {
    var day = state.days[currentDay];
    var week = Math.ceil(currentDay / 7);
    $("#weekEyebrow").textContent = WEEK_NAMES[week];
    $("#dayKicker").textContent = "Day " + String(currentDay).padStart(2, "0") + " of 21 — Week " + week;
    $("#dayHeading").textContent = PILLARS[0].title + " through " + PILLARS[5].title + " · Day " + currentDay;
    $("#reflectionDay").textContent = "(Day " + currentDay + ")";
    $("#logDate").value = day.date;
    $("#logMood").value = day.mood;
    $("#reflection").value = day.reflection;
    $("#daySaveStatus").textContent = "All changes saved";
    $("#daySaveStatus").style.color = "";
    $("#prevDay").disabled = currentDay === 1;
    $("#nextDay").disabled = currentDay === 21;

    $("#logRows").innerHTML = PILLARS.map(function (p) {
      var checked = day.done[p.id] ? ' checked' : '';
      return '<tr><th scope="row"><span class="pillar-number">' + p.n + '.</span> ' + p.title +
        '<span class="pillar-focus">' + p.focus + '</span></th>' +
        '<td>' + notesControl(p, day) + '</td>' +
        '<td><label class="check-label"><input type="checkbox" data-done="' + p.id + '"' + checked +
        ' aria-label="Mark ' + p.title + ' complete for Day ' + currentDay + '"> Done</label></td></tr>';
    }).join("");
  }

  function renderWeekTabs() {
    document.querySelectorAll(".week-tab").forEach(function (tab) {
      var active = Number(tab.dataset.week) === currentWeek;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $("#dayPanel").setAttribute("aria-labelledby", "tab-w" + currentWeek);
  }

  function setWeek(week) {
    currentWeek = week;
    currentDay = (week - 1) * 7 + 1;
    renderWeekTabs(); renderDayStrip(); renderLog(); refreshProgress();
  }

  function setDay(day, scroll) {
    currentDay = Math.max(1, Math.min(21, day));
    currentWeek = Math.ceil(currentDay / 7);
    renderWeekTabs(); renderDayStrip(); renderLog(); refreshProgress();
    document.querySelectorAll(".day-head").forEach(function (b) {
      b.classList.toggle("is-current", Number(b.dataset.day) === currentDay);
    });
    if (scroll) $("#daily").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeAttr(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeText(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Events
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-commit")) {
      state.commitments[t.dataset.commit] = t.value; schedulePersist(); return;
    }
    if (t.hasAttribute("data-baseline")) {
      state.baseline[t.dataset.baseline] = t.value; schedulePersist(); return;
    }
    if (t.hasAttribute("data-note")) {
      state.days[currentDay].notes[t.dataset.note] = t.value; schedulePersist(); return;
    }
    if (t.hasAttribute("data-save")) {
      state.days[currentDay][t.dataset.save] = t.value;
      if (t.dataset.save === "reflection") refreshProgress();
      schedulePersist();
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    var day = state.days[currentDay];
    if (t.hasAttribute("data-done")) {
      day.done[t.dataset.done] = t.checked; persist(false); renderDayStrip(); return;
    }
    if (t.hasAttribute("data-skin")) {
      day.skincare[t.dataset.skin] = t.checked; persist(false); return;
    }
    if (t.hasAttribute("data-salah")) {
      day.salah[t.dataset.salah] = t.checked; persist(false); return;
    }
  });

  document.addEventListener("click", function (e) {
    var dot = e.target.closest(".habit-dot");
    if (dot) {
      var h = dot.dataset.habit, d = Number(dot.dataset.day) - 1;
      state.habits[h][d] = !state.habits[h][d];
      dot.setAttribute("aria-pressed", String(state.habits[h][d]));
      persist(true);
      return;
    }
    var dayHead = e.target.closest(".day-head");
    if (dayHead) { setDay(Number(dayHead.dataset.day), true); return; }
    var chip = e.target.closest(".day-chip");
    if (chip) { setDay(Number(chip.dataset.day), false); return; }
    var tab = e.target.closest(".week-tab");
    if (tab) { setWeek(Number(tab.dataset.week)); return; }
  });

  document.querySelectorAll(".week-tab").forEach(function (tab, i, tabs) {
    tab.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var next = tabs[(tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      setWeek(Number(next.dataset.week)); next.focus();
    });
  });

  $("#beginBtn").addEventListener("click", function () { setDay(Math.max(1, currentDay), true); });
  $("#prevDay").addEventListener("click", function () { setDay(currentDay - 1, false); });
  $("#nextDay").addEventListener("click", function () { setDay(currentDay + 1, false); });
  $("#printBtn").addEventListener("click", function () { window.print(); });

  // Installable web app: register only when served over http(s). Electron's
  // file:// origin does not support service workers, so skip it there.
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () { /* offline support unavailable */ });
    });
  }
  var installPrompt = null;
  var installBtn = $("#installBtn");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", function () {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then(function () { installPrompt = null; installBtn.hidden = true; });
  });

  $("#resetBtn").addEventListener("click", function () {
    if (!window.confirm("Reset this journal? Every commitment, habit mark, note, and reflection saved in this browser will be permanently erased.")) return;
    state = blankState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage already unavailable */ }
    var retry = $("#retrySave"); if (retry) retry.remove();
    currentWeek = 1; currentDay = 1;
    renderPillars(); renderBaseline(); renderTracker(); renderWeekTabs(); renderDayStrip(); renderLog(); refreshProgress();
    toast("Journal reset. All entries have been cleared.");
  });

  // Source-page preview dialog
  var sourceDialog = $("#sourceDialog");
  document.querySelectorAll(".source-open").forEach(function (button) {
    button.addEventListener("click", function () {
      var image = button.querySelector("img");
      $("#sourceImage").src = button.dataset.source;
      $("#sourceImage").alt = image.alt;
      sourceDialog.showModal();
    });
  });
  $("#sourceClose").addEventListener("click", function () { sourceDialog.close(); });
  sourceDialog.addEventListener("click", function (e) { if (e.target === sourceDialog) sourceDialog.close(); });

  // Initial render
  renderPillars();
  renderBaseline();
  renderTracker();
  renderWeekTabs();
  renderDayStrip();
  renderLog();
  refreshProgress();
})();
