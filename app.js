/* =========================================
   Paced — Interactive Prototype Controller
   ========================================= */

const DAY_START_HOUR = 8;
const DAY_TOTAL_MINUTES = 600; // 8:00 AM to 6:00 PM
const EVENT_BUFFER_MINUTES = 10;

const DAYS = [
  { key: "mon", label: "Mon", fullLabel: "Monday, November 23", date: "2026-11-23" },
  { key: "tue", label: "Tue", fullLabel: "Tuesday, November 24", date: "2026-11-24" },
  { key: "wed", label: "Wed", fullLabel: "Wednesday, November 25", date: "2026-11-25" },
  { key: "thu", label: "Thu", fullLabel: "Thursday, November 26", date: "2026-11-26" },
  { key: "fri", label: "Fri", fullLabel: "Friday, November 27", date: "2026-11-27" }
];

const FIXED_EVENTS = {
  mon: [
    { start: 60, duration: 75, title: "Entrepreneurship Seminar", type: "class" },
    { start: 180, duration: 60, title: "Operations Strategy", type: "class" },
    { start: 300, duration: 240, title: "Part-Time Shift", type: "work" }
  ],
  tue: [
    { start: 90, duration: 75, title: "Financial Management", type: "class" },
    { start: 240, duration: 75, title: "Business Law", type: "class" }
  ],
  wed: [
    { start: 60, duration: 75, title: "Entrepreneurship Seminar", type: "class" },
    { start: 180, duration: 60, title: "Operations Strategy", type: "class" },
    { start: 360, duration: 180, title: "Part-Time Shift", type: "work" }
  ],
  thu: [
    { start: 0, duration: 480, title: "Work Shift", type: "work" }
  ],
  fri: [
    { start: 60, duration: 75, title: "Entrepreneurship Seminar", type: "class" },
    { start: 180, duration: 60, title: "Operations Strategy", type: "class" }
  ]
};

const PRESETS = {
  "case-study": {
    title: "Market Entry Case Study",
    defaultDue: "2026-11-27",
    chunksBySize: {
      "5-10": [
        { title: "Skim prompt & grading rubric", duration: 5 },
        { title: "List company strengths & weaknesses", duration: 10 },
        { title: "Identify 2 market threats", duration: 10 },
        { title: "Outline recommendation #1", duration: 10 },
        { title: "Outline recommendations #2 & #3", duration: 10 },
        { title: "Format citations & final proofread", duration: 10 }
      ],
      "10-15": [
        { title: "Review prompt & rubric criteria", duration: 10 },
        { title: "Highlight key SWOT data points", duration: 15 },
        { title: "Draft 3 strategic recommendations", duration: 15 },
        { title: "Format citations & proofread", duration: 10 }
      ],
      "15-20": [
        { title: "Read case & map SWOT matrix", duration: 20 },
        { title: "Write recommendations & financial impact", duration: 20 },
        { title: "Executive summary & final polish", duration: 15 }
      ]
    }
  },
  "research-paper": {
    title: "Supply Chain Resilience Paper",
    defaultDue: "2026-11-27",
    chunksBySize: {
      "5-10": [
        { title: "Break down rubric weightings", duration: 5 },
        { title: "Find 2 peer-reviewed sources", duration: 10 },
        { title: "Find 2 additional industry articles", duration: 10 },
        { title: "Draft thesis & section headers", duration: 10 },
        { title: "Write opening paragraph", duration: 10 },
        { title: "Draft body argument #1", duration: 10 },
        { title: "Draft body argument #2", duration: 10 },
        { title: "Check APA references & polish", duration: 10 }
      ],
      "10-15": [
        { title: "Review rubric & lock thesis", duration: 10 },
        { title: "Gather 4 credible sources", duration: 15 },
        { title: "Outline intro & 3 main points", duration: 15 },
        { title: "Draft core analysis section", duration: 15 },
        { title: "Write conclusion & APA citations", duration: 15 }
      ],
      "15-20": [
        { title: "Source gathering & thesis outline", duration: 20 },
        { title: "Draft body sections 1 & 2", duration: 20 },
        { title: "Draft section 3 & conclusion", duration: 20 },
        { title: "Rubric check & APA formatting", duration: 15 }
      ]
    }
  },
  "lab-report": {
    title: "Operations Forecasting Lab",
    defaultDue: "2026-11-26",
    chunksBySize: {
      "5-10": [
        { title: "Inspect dataset & rubric checklist", duration: 10 },
        { title: "Run moving average formula", duration: 10 },
        { title: "Calculate MAD & MAPE error", duration: 10 },
        { title: "Export trendline chart", duration: 5 },
        { title: "Summarize findings & submit", duration: 10 }
      ],
      "10-15": [
        { title: "Clean dataset & check rubric", duration: 10 },
        { title: "Build forecasting formulas", duration: 15 },
        { title: "Generate charts & error metrics", duration: 15 },
        { title: "Write brief takeaways & proofread", duration: 10 }
      ],
      "15-20": [
        { title: "Dataset prep & forecasting model", duration: 20 },
        { title: "Error analysis, visuals & summary", duration: 20 }
      ]
    }
  }
};

// Application State
let activePresetKey = "case-study";
let customUploadData = null;
let scheduledChunks = [];
let lastSidebarAssignment = "";
let nextChunkId = 1;

// Simulated Clock State (Default: Mon Nov 23 at 8:30 AM)
let simDayIndex = 0;
let simMinutes = 30; // Minutes since 8:00 AM

// Phone Focus Timer State
let activeTimerChunkId = null;
let timerSecondsRemaining = 0;
let timerInterval = null;
let timerPaused = false;

// DOM References — Navigation & Views
const navLinks = document.querySelectorAll(".nav-link[data-view]");
const viewPanels = {
  scheduler: document.getElementById("view-scheduler"),
  assignments: document.getElementById("view-assignments"),
  notifications: document.getElementById("view-notifications")
};

// DOM References — Scheduler & Demo Clock
const presetButtons = document.querySelectorAll(".preset-btn");
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("rubric-file");
const uploadTitle = uploadZone.querySelector(".upload-title");
const uploadSubtitle = uploadZone.querySelector(".upload-subtitle");
const scheduleForm = document.getElementById("schedule-form");
const dueDateInput = document.getElementById("due-date");
const chunkLengthSelect = document.getElementById("chunk-length");
const generateBtn = document.getElementById("generate-btn");
const resetDemoBtn = document.getElementById("reset-demo-btn");
const chunkCountEl = document.getElementById("chunk-count");
const assignmentMetaEl = document.querySelector(".assignment-meta");
const chunkListEl = document.getElementById("chunk-list");
const toastTimeEl = document.querySelector(".toast-time");
const toastBodyEl = document.querySelector(".toast-body");
const statusDotEl = document.querySelector(".status-dot");

const demoDaySelect = document.getElementById("demo-day-select");
const demoTimeInput = document.getElementById("demo-time-input");
const jumpHourBtn = document.getElementById("jump-hour-btn");
const jumpDayBtn = document.getElementById("jump-day-btn");
const rescheduleStatusEl = document.getElementById("reschedule-status");

// DOM References — Assignments View
const statAssignmentsEl = document.getElementById("stat-assignments");
const statCompletedEl = document.getElementById("stat-completed");
const statMinutesEl = document.getElementById("stat-minutes");
const statProgressEl = document.getElementById("stat-progress");
const assignmentsGridEl = document.getElementById("assignments-grid");
const addAssignmentJumpBtn = document.getElementById("add-assignment-jump-btn");

// DOM References — Notifications View
const notifLeadTimeSelect = document.getElementById("notif-lead-time");
const notifToneSelect = document.getElementById("notif-tone");
const simulateNudgeBtn = document.getElementById("simulate-nudge-btn");
const phoneNotificationStack = document.getElementById("phone-notification-stack");
const phoneScreenClockEl = document.getElementById("phone-screen-clock");
const phoneDateEl = document.querySelector(".phone-date");
const phoneBigTimeEl = document.querySelector(".phone-big-time");
const phoneTimerPanel = document.getElementById("phone-timer-panel");
const timerTaskTitleEl = document.getElementById("timer-task-title");
const timerCountdownEl = document.getElementById("timer-countdown");
const timerToggleBtn = document.getElementById("timer-toggle-btn");
const timerCompleteBtn = document.getElementById("timer-complete-btn");
const timerCloseBtn = document.getElementById("timer-close-btn");

/* =========================================
   Helpers: Time, Date & View Switching
   ========================================= */
function getDayIndexByKey(dayKey) {
  return DAYS.findIndex((d) => d.key === dayKey);
}

function formatMinutesToTime(minutesFromStart) {
  const totalMinutes = DAY_START_HOUR * 60 + minutesFromStart;
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

function formatMinutesTo24hInput(minutesFromStart) {
  const totalMinutes = DAY_START_HOUR * 60 + minutesFromStart;
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTimeInputToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 30;
  const minsSinceStart = (h - DAY_START_HOUR) * 60 + m;
  return Math.max(0, Math.min(DAY_TOTAL_MINUTES - 15, minsSinceStart));
}

function formatRangeShort(start, duration) {
  const startStr = formatMinutesToTime(start).replace(/ [AP]M/, "");
  const endStr = formatMinutesToTime(start + duration).replace(/ [AP]M/, "");
  return `${startStr} – ${endStr}`;
}

function formatDueDateLabel(dateString) {
  const match = DAYS.find((d) => d.date === dateString);
  if (match) return `${match.label} 11:59 PM`;
  const [y, m, d] = dateString.split("-");
  return `${m}/${d}/${y}`;
}

function switchView(viewName) {
  Object.entries(viewPanels).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle("is-hidden", key !== viewName);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

  if (viewName === "assignments") renderAssignmentsView();
  if (viewName === "notifications") renderNotificationsView();
}

function updateClockStatusBadge(message, tone = "neutral") {
  if (!rescheduleStatusEl) return;
  rescheduleStatusEl.textContent = message;
  rescheduleStatusEl.classList.remove("has-update", "has-warning");
  if (tone === "update") rescheduleStatusEl.classList.add("has-update");
  if (tone === "warning") rescheduleStatusEl.classList.add("has-warning");
}

function syncClockControlsUI() {
  if (demoDaySelect) demoDaySelect.value = String(simDayIndex);
  if (demoTimeInput) demoTimeInput.value = formatMinutesTo24hInput(simMinutes);

  // Sync phone lock-screen clock too
  const displayClock = formatMinutesToTime(simMinutes).replace(/ [AP]M/, "");
  if (phoneScreenClockEl) phoneScreenClockEl.textContent = displayClock;
  if (phoneBigTimeEl) phoneBigTimeEl.textContent = displayClock;
  if (phoneDateEl) phoneDateEl.textContent = DAYS[simDayIndex].fullLabel;
}

/* =========================================
   Core Gap-Finding & Auto-Rescheduling Engine
   ========================================= */
function getOccupiedIntervals(dayKey, excludeChunkId = null) {
  const fixed = (FIXED_EVENTS[dayKey] || []).map((ev) => ({
    start: ev.start,
    end: ev.start + ev.duration
  }));

  const placed = scheduledChunks
    .filter((ch) => ch.day === dayKey && ch.id !== excludeChunkId)
    .map((ch) => ({
      start: ch.start,
      end: ch.start + ch.duration
    }));

  return [...fixed, ...placed].sort((a, b) => a.start - b.start);
}

function findAvailableSlot(dayKey, duration, minStart = 30, excludeChunkId = null) {
  const intervals = getOccupiedIntervals(dayKey, excludeChunkId);
  const candidateGaps = [];
  let cursor = minStart;

  for (const block of intervals) {
    if (block.end <= cursor) continue;
    const gapStart = cursor;
    const gapEnd = block.start - EVENT_BUFFER_MINUTES;
    if (gapEnd - gapStart >= duration) {
      candidateGaps.push({
        start: gapStart,
        length: gapEnd - gapStart,
        isBetweenEvents: cursor > minStart
      });
    }
    cursor = Math.max(cursor, block.end + EVENT_BUFFER_MINUTES);
  }

  if (DAY_TOTAL_MINUTES - cursor >= duration) {
    candidateGaps.push({
      start: cursor,
      length: DAY_TOTAL_MINUTES - cursor,
      isBetweenEvents: false
    });
  }

  if (candidateGaps.length === 0) return null;

  candidateGaps.sort((a, b) => {
    if (a.isBetweenEvents !== b.isBetweenEvents) {
      return a.isBetweenEvents ? -1 : 1;
    }
    return a.start - b.start;
  });

  const chosenStart = Math.ceil(candidateGaps[0].start / 5) * 5;
  return {
    start: chosenStart,
    gapLength: candidateGaps[0].length
  };
}

function getEligibleDays(dueDateStr, startFromIndex = simDayIndex) {
  const dueIndex = DAYS.findIndex((d) => d.date === dueDateStr);
  const endIndex = dueIndex >= 0 ? Math.max(dueIndex, startFromIndex) : DAYS.length - 1;
  return DAYS.slice(startFromIndex, endIndex + 1);
}

function getMinStartForDay(dayIdx) {
  if (dayIdx === simDayIndex) {
    return Math.max(30, simMinutes + 5);
  }
  return 30;
}

function scheduleAssignment(assignmentTitle, rawChunks, dueDateStr) {
  const eligibleDays = getEligibleDays(dueDateStr, simDayIndex);
  const newlyScheduled = [];

  rawChunks.forEach((chunk, index) => {
    let placedSlot = null;
    let placedDay = null;

    for (let offset = 0; offset < eligibleDays.length; offset++) {
      const dayObj = eligibleDays[(index + offset) % eligibleDays.length];
      const dayIdx = getDayIndexByKey(dayObj.key);
      const slot = findAvailableSlot(dayObj.key, chunk.duration, getMinStartForDay(dayIdx));
      if (slot) {
        placedSlot = slot;
        placedDay = dayObj;
        break;
      }
    }

    if (placedSlot && placedDay) {
      const newChunk = {
        id: `chunk-${nextChunkId++}`,
        assignmentTitle,
        dueDate: dueDateStr,
        title: chunk.title,
        duration: chunk.duration,
        day: placedDay.key,
        dayLabel: placedDay.label,
        start: placedSlot.start,
        gapLength: Math.min(placedSlot.gapLength, 60),
        completed: false,
        rescheduled: false,
        atRisk: false,
        isNew: true
      };
      scheduledChunks.push(newChunk);
      newlyScheduled.push(newChunk);
    }
  });

  return newlyScheduled;
}

/**
 * Checks every incomplete chunk against the simulated clock.
 * Any incomplete chunk whose start time is now in the past gets
 * automatically moved to the earliest open gap after the current time.
 */
function rescheduleMissedChunks() {
  const missed = scheduledChunks
    .filter((ch) => {
      if (ch.completed) return false;
      const chDayIdx = getDayIndexByKey(ch.day);
      return chDayIdx < simDayIndex || (chDayIdx === simDayIndex && ch.start < simMinutes);
    })
    .sort((a, b) => {
      const dayDiff = getDayIndexByKey(a.day) - getDayIndexByKey(b.day);
      return dayDiff !== 0 ? dayDiff : a.start - b.start;
    });

  if (missed.length === 0) {
    updateClockStatusBadge(`Clock set to ${DAYS[simDayIndex].label} ${formatMinutesToTime(simMinutes)}`, "neutral");
    return { movedCount: 0, atRiskCount: 0 };
  }

  let movedCount = 0;
  let atRiskCount = 0;

  missed.forEach((chunk) => {
    const dueIdx = DAYS.findIndex((d) => d.date === chunk.dueDate);
    const maxPreferredIdx = dueIdx >= simDayIndex ? dueIdx : DAYS.length - 1;

    // Try days up to due date first, then spill over to remaining days of the week if needed
    const searchOrder = [];
    for (let i = simDayIndex; i <= maxPreferredIdx; i++) searchOrder.push(i);
    for (let i = maxPreferredIdx + 1; i < DAYS.length; i++) searchOrder.push(i);

    let newSlot = null;
    let newDay = null;

    for (const dayIdx of searchOrder) {
      const dayObj = DAYS[dayIdx];
      const slot = findAvailableSlot(
        dayObj.key,
        chunk.duration,
        getMinStartForDay(dayIdx),
        chunk.id
      );
      if (slot) {
        newSlot = slot;
        newDay = dayObj;
        break;
      }
    }

    if (newSlot && newDay) {
      chunk.day = newDay.key;
      chunk.dayLabel = newDay.label;
      chunk.start = newSlot.start;
      chunk.gapLength = Math.min(newSlot.gapLength, 60);
      chunk.rescheduled = true;
      chunk.atRisk = false;
      chunk.isNew = true;
      movedCount += 1;
    } else {
      // No open slots left before Friday 6:00 PM
      chunk.atRisk = true;
      atRiskCount += 1;
    }
  });

  if (atRiskCount > 0 && movedCount > 0) {
    updateClockStatusBadge(
      `Rescheduled ${movedCount} chunk${movedCount > 1 ? "s" : ""} · ${atRiskCount} past window`,
      "warning"
    );
  } else if (atRiskCount > 0) {
    updateClockStatusBadge(
      `${atRiskCount} incomplete chunk${atRiskCount > 1 ? "s" : ""} out of weekly gaps`,
      "warning"
    );
  } else if (movedCount > 0) {
    updateClockStatusBadge(
      `Auto-rescheduled ${movedCount} missed chunk${movedCount > 1 ? "s" : ""}`,
      "update"
    );
  }

  return { movedCount, atRiskCount };
}

function setSimulatedDateTime(newDayIndex, newMinutes) {
  simDayIndex = Math.max(0, Math.min(DAYS.length - 1, newDayIndex));
  simMinutes = Math.max(0, Math.min(DAY_TOTAL_MINUTES - 15, newMinutes));

  syncClockControlsUI();
  rescheduleMissedChunks();

  // Pick the next upcoming incomplete chunk to highlight in the mobile preview
  const upcoming = getUpcomingIncompleteChunks();
  renderAllViews(upcoming[0] || null);
}

function getUpcomingIncompleteChunks() {
  return scheduledChunks
    .filter((ch) => !ch.completed)
    .sort((a, b) => {
      const dayDiff = getDayIndexByKey(a.day) - getDayIndexByKey(b.day);
      return dayDiff !== 0 ? dayDiff : a.start - b.start;
    });
}

/* =========================================
   Rendering: All Synced Views
   ========================================= */
function renderAllViews(highlightChunk = null) {
  renderCalendar();
  renderSidebarForCurrentAssignment();
  renderAssignmentsView();
  renderNotificationsView();

  const nextPending =
    highlightChunk || getUpcomingIncompleteChunks()[0] || scheduledChunks[0] || null;
  updateNotificationPreview(nextPending);
}

function renderCalendar() {
  // Highlight simulated "Today" header
  const dayHeaders = document.querySelectorAll(".day-header");
  dayHeaders.forEach((header, idx) => {
    header.classList.toggle("is-today", idx === simDayIndex);
  });

  DAYS.forEach((dayObj, dayIdx) => {
    const col = document.querySelector(`.day-column[data-day="${dayObj.key}"]`);
    if (!col) return;
    col.innerHTML = "";

    // Past-time shading
    if (dayIdx < simDayIndex) {
      const overlay = document.createElement("div");
      overlay.className = "past-overlay";
      overlay.style.setProperty("--past-height", DAY_TOTAL_MINUTES);
      col.appendChild(overlay);
    } else if (dayIdx === simDayIndex) {
      if (simMinutes > 0) {
        const overlay = document.createElement("div");
        overlay.className = "past-overlay";
        overlay.style.setProperty("--past-height", simMinutes);
        col.appendChild(overlay);
      }

      const nowLine = document.createElement("div");
      nowLine.className = "now-line";
      nowLine.style.setProperty("--now", simMinutes);
      nowLine.title = `Current demo time: ${formatMinutesToTime(simMinutes)}`;
      col.appendChild(nowLine);
    }

    // Fixed Class & Work Events
    (FIXED_EVENTS[dayObj.key] || []).forEach((ev) => {
      const article = document.createElement("article");
      article.className = `event event-${ev.type}`;
      article.style.setProperty("--start", ev.start);
      article.style.setProperty("--duration", ev.duration);
      article.innerHTML = `
        <span class="event-time">${formatRangeShort(ev.start, ev.duration)}</span>
        <h3 class="event-title">${ev.title}</h3>
      `;
      col.appendChild(article);
    });

    // Scheduled Micro-Chunks
    const dayChunks = scheduledChunks.filter((ch) => ch.day === dayObj.key);
    dayChunks.forEach((chunk) => {
      const classes = ["event", "event-chunk"];
      if (chunk.completed) classes.push("is-completed");
      if (chunk.rescheduled && !chunk.completed) classes.push("is-rescheduled");
      if (chunk.atRisk && !chunk.completed) classes.push("is-at-risk");
      if (chunk.isNew) classes.push("is-pop-in");

      const article = document.createElement("article");
      article.className = classes.join(" ");
      article.dataset.chunkId = chunk.id;
      article.style.setProperty("--start", chunk.start);
      article.style.setProperty("--duration", Math.max(chunk.duration, 15));

      const statusNote = chunk.atRisk
        ? " • Needs extra time"
        : chunk.rescheduled
          ? " • Auto-rescheduled"
          : "";
      article.title = `${chunk.assignmentTitle} • ${formatMinutesToTime(chunk.start)}${statusNote} (Click to toggle complete)`;

      const prefix = chunk.completed ? "✓ " : chunk.rescheduled ? "↻ " : "";
      article.innerHTML = `
        <span class="event-title">${prefix}${chunk.duration}m: ${chunk.title}</span>
      `;
      article.addEventListener("click", () => toggleChunkCompletion(chunk.id));
      col.appendChild(article);
    });
  });

  scheduledChunks.forEach((ch) => (ch.isNew = false));
}

function renderSidebarForCurrentAssignment() {
  const matching = lastSidebarAssignment
    ? scheduledChunks.filter((ch) => ch.assignmentTitle === lastSidebarAssignment)
    : [];

  const chunksToDisplay = matching.length > 0 ? matching : scheduledChunks;
  const totalMinutes = chunksToDisplay.reduce((sum, ch) => sum + ch.duration, 0);
  chunkCountEl.textContent = `${chunksToDisplay.length} tasks · ${totalMinutes}m`;

  if (chunksToDisplay.length === 0) {
    assignmentMetaEl.textContent =
      "No micro-chunks scheduled yet. Choose a preset or drop a rubric above.";
    chunkListEl.innerHTML = `<li class="chunk-empty">Calendar is clear of homework chunks.</li>`;
    return;
  }

  const headerTitle =
    matching.length > 0 ? lastSidebarAssignment : chunksToDisplay[0].assignmentTitle;
  const dueStr = chunksToDisplay[0].dueDate;
  assignmentMetaEl.innerHTML = `<strong>${headerTitle}</strong> &middot; Due ${formatDueDateLabel(dueStr)}`;
  chunkListEl.innerHTML = "";

  chunksToDisplay.forEach((chunk) => {
    const li = document.createElement("li");
    li.className = `chunk-item is-scheduled${chunk.completed ? " is-completed" : ""}`;
    li.dataset.chunkId = chunk.id;
    const movedTag =
      chunk.rescheduled && !chunk.completed
        ? `<span class="chunk-badge-moved">Moved</span>`
        : "";
    li.innerHTML = `
      <div class="chunk-item-main">
        <span class="chunk-dot"></span>
        <span class="chunk-title">${chunk.title}</span>
        ${movedTag}
      </div>
      <span class="chunk-duration">${chunk.dayLabel} · ${chunk.duration}m</span>
    `;
    li.addEventListener("click", () => focusChunkOnCalendar(chunk));
    chunkListEl.appendChild(li);
  });
}

function updateNotificationPreview(chunk) {
  if (!chunk) {
    statusDotEl.textContent = "Standby";
    toastTimeEl.textContent = "Waiting for schedule";
    toastBodyEl.textContent =
      "Add an assignment rubric to preview automated mobile reminders.";
    return;
  }

  statusDotEl.textContent = chunk.completed
    ? "Completed"
    : chunk.rescheduled
      ? "Rescheduled"
      : "Scheduled";
  toastTimeEl.textContent = `${chunk.dayLabel} · ${formatMinutesToTime(chunk.start)}`;

  if (chunk.completed) {
    toastBodyEl.innerHTML = `Nice work! You finished <strong>${chunk.title} (${chunk.duration}m)</strong> ahead of your deadline.`;
  } else if (chunk.rescheduled) {
    toastBodyEl.innerHTML = `No stress—we moved <strong>${chunk.title} (${chunk.duration}m)</strong> to your next open gap on ${chunk.dayLabel} at ${formatMinutesToTime(chunk.start)}.`;
  } else {
    const gapText =
      chunk.gapLength >= 30 ? "a free window" : `a ${chunk.gapLength}-minute gap`;
    toastBodyEl.innerHTML = `You have ${gapText} coming up. Knock out <strong>${chunk.title} (${chunk.duration}m)</strong> for ${chunk.assignmentTitle}?`;
  }
}

/* =========================================
   View 2: Assignments Tracker Rendering
   ========================================= */
function renderAssignmentsView() {
  if (!assignmentsGridEl) return;

  const grouped = new Map();
  scheduledChunks.forEach((chunk) => {
    if (!grouped.has(chunk.assignmentTitle)) {
      grouped.set(chunk.assignmentTitle, {
        title: chunk.assignmentTitle,
        dueDate: chunk.dueDate,
        chunks: []
      });
    }
    grouped.get(chunk.assignmentTitle).chunks.push(chunk);
  });

  const totalChunks = scheduledChunks.length;
  const completedChunks = scheduledChunks.filter((c) => c.completed).length;
  const totalMinutes = scheduledChunks.reduce((sum, c) => sum + c.duration, 0);
  const pct = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;

  statAssignmentsEl.textContent = grouped.size;
  statCompletedEl.textContent = `${completedChunks} / ${totalChunks}`;
  statMinutesEl.textContent = `${totalMinutes} min`;
  statProgressEl.textContent = `${pct}%`;

  assignmentsGridEl.innerHTML = "";

  if (grouped.size === 0) {
    assignmentsGridEl.innerHTML = `
      <div class="card empty-state-card">
        <h3>No assignments scheduled yet</h3>
        <p style="margin-top: 0.4rem;">Drop a rubric PDF or choose a demo preset in the Scheduler to get started.</p>
      </div>
    `;
    return;
  }

  grouped.forEach((group) => {
    const doneCount = group.chunks.filter((c) => c.completed).length;
    const groupPct = Math.round((doneCount / group.chunks.length) * 100);
    const groupMins = group.chunks.reduce((sum, c) => sum + c.duration, 0);

    const card = document.createElement("article");
    card.className = "card assignment-card";

    card.innerHTML = `
      <div class="assignment-card-top">
        <div>
          <h3 class="assignment-card-title">${group.title}</h3>
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem;">
            ${group.chunks.length} micro-chunks &middot; ${groupMins} min total
          </p>
        </div>
        <span class="assignment-due-badge">Due ${formatDueDateLabel(group.dueDate)}</span>
      </div>

      <div>
        <div class="progress-row">
          <span>Progress</span>
          <strong>${doneCount}/${group.chunks.length} (${groupPct}%)</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${groupPct}%;"></div>
        </div>
      </div>

      <ul class="assignment-checklist"></ul>

      <div class="assignment-card-footer">
        <button type="button" class="btn-danger-link">Remove Assignment</button>
      </div>
    `;

    const list = card.querySelector(".assignment-checklist");
    group.chunks.forEach((chunk) => {
      const li = document.createElement("li");
      li.className = `checklist-row${chunk.completed ? " is-completed" : ""}`;
      li.innerHTML = `
        <label class="checklist-label">
          <input type="checkbox" ${chunk.completed ? "checked" : ""} />
          <span class="checklist-text">${chunk.title}</span>
        </label>
        <span class="checklist-slot">${chunk.dayLabel} ${formatMinutesToTime(chunk.start)} &middot; ${chunk.duration}m</span>
      `;
      li.querySelector("input").addEventListener("change", () => {
        toggleChunkCompletion(chunk.id);
      });
      list.appendChild(li);
    });

    card.querySelector(".btn-danger-link").addEventListener("click", () => {
      scheduledChunks = scheduledChunks.filter(
        (ch) => ch.assignmentTitle !== group.title
      );
      if (lastSidebarAssignment === group.title) {
        lastSidebarAssignment = scheduledChunks[0]?.assignmentTitle || "";
      }
      renderAllViews();
    });

    assignmentsGridEl.appendChild(card);
  });
}

/* =========================================
   View 3: Mobile Notifications & Live Timer
   ========================================= */
function buildNudgeCopy(chunk) {
  const tone = notifToneSelect ? notifToneSelect.value : "encouraging";
  if (chunk.rescheduled && tone === "encouraging") {
    return `Life happens—we bumped <strong>${chunk.title} (${chunk.duration}m)</strong> into your open ${chunk.dayLabel} gap. Ready to knock it out?`;
  }
  if (tone === "direct") {
    return `Scheduled now (${chunk.duration}m): <strong>${chunk.title}</strong> — ${chunk.assignmentTitle}.`;
  }
  if (tone === "accountability") {
    return `Stay ahead of your ${formatDueDateLabel(chunk.dueDate)} deadline. Knock out <strong>${chunk.title} (${chunk.duration}m)</strong> before your next block.`;
  }
  return `Quick ${chunk.duration}-minute win! You have an open gap right now for <strong>${chunk.title}</strong>.`;
}

function renderNotificationsView(pingTopCard = false) {
  if (!phoneNotificationStack) return;

  const leadMinutes = Number(notifLeadTimeSelect ? notifLeadTimeSelect.value : 5);
  const upcoming = getUpcomingIncompleteChunks().slice(0, 4);

  phoneNotificationStack.innerHTML = "";

  if (upcoming.length === 0) {
    phoneNotificationStack.innerHTML = `
      <div class="phone-notif-card">
        <div class="phone-notif-top">
          <span class="phone-notif-app">Paced</span>
          <span>All caught up</span>
        </div>
        <p class="phone-notif-msg">No pending homework chunks! Schedule a rubric to preview live mobile nudges.</p>
      </div>
    `;
    return;
  }

  upcoming.forEach((chunk, idx) => {
    const notifyAt = Math.max(0, chunk.start - leadMinutes);
    const card = document.createElement("div");
    card.className = `phone-notif-card${pingTopCard && idx === 0 ? " is-live-ping" : ""}`;
    card.innerHTML = `
      <div class="phone-notif-top">
        <span class="phone-notif-app">Paced</span>
        <span>${chunk.dayLabel} &middot; ${formatMinutesToTime(notifyAt)}</span>
      </div>
      <p class="phone-notif-msg">${buildNudgeCopy(chunk)}</p>
      <div class="phone-notif-actions">
        <button type="button" class="phone-btn phone-btn-accent" data-action="start">
          Start ${chunk.duration}m Timer
        </button>
        <button type="button" class="phone-btn phone-btn-secondary" data-action="snooze">
          Snooze 15m
        </button>
      </div>
    `;

    card.querySelector('[data-action="start"]').addEventListener("click", () => {
      startPhoneFocusTimer(chunk);
    });

    card.querySelector('[data-action="snooze"]').addEventListener("click", () => {
      snoozeChunk(chunk.id);
    });

    phoneNotificationStack.appendChild(card);
  });
}

function snoozeChunk(chunkId) {
  const target = scheduledChunks.find((ch) => ch.id === chunkId);
  if (!target) return;

  const currentIdx = getDayIndexByKey(target.day);
  const minSameDay = Math.max(
    target.start + 15,
    currentIdx === simDayIndex ? simMinutes + 5 : 30
  );

  const laterSlot = findAvailableSlot(target.day, target.duration, minSameDay, target.id);

  if (laterSlot) {
    target.start = laterSlot.start;
    target.rescheduled = true;
    target.isNew = true;
  } else {
    for (let nextIdx = currentIdx + 1; nextIdx < DAYS.length; nextIdx++) {
      const nextDay = DAYS[nextIdx];
      const nextDaySlot = findAvailableSlot(
        nextDay.key,
        target.duration,
        getMinStartForDay(nextIdx),
        target.id
      );
      if (nextDaySlot) {
        target.day = nextDay.key;
        target.dayLabel = nextDay.label;
        target.start = nextDaySlot.start;
        target.rescheduled = true;
        target.isNew = true;
        break;
      }
    }
  }

  renderAllViews(target);
}

function startPhoneFocusTimer(chunk) {
  stopPhoneFocusTimer();
  activeTimerChunkId = chunk.id;
  timerSecondsRemaining = chunk.duration * 60;
  timerPaused = false;

  timerTaskTitleEl.textContent = chunk.title;
  timerToggleBtn.textContent = "Pause";
  phoneTimerPanel.classList.remove("is-hidden");
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (timerPaused) return;
    timerSecondsRemaining -= 1;
    updateTimerDisplay();

    if (timerSecondsRemaining <= 0) {
      completeActiveTimerChunk();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSecondsRemaining / 60);
  const secs = timerSecondsRemaining % 60;
  timerCountdownEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function stopPhoneFocusTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  activeTimerChunkId = null;
  if (phoneTimerPanel) phoneTimerPanel.classList.add("is-hidden");
}

function completeActiveTimerChunk() {
  if (!activeTimerChunkId) return;
  const target = scheduledChunks.find((ch) => ch.id === activeTimerChunkId);
  if (target) {
    target.completed = true;
    target.atRisk = false;
  }
  stopPhoneFocusTimer();
  renderAllViews(target);
}

/* =========================================
   Interactions: Focus, Toggle & Rubric Upload
   ========================================= */
function focusChunkOnCalendar(chunk) {
  updateNotificationPreview(chunk);
  document.querySelectorAll(".chunk-item").forEach((el) => {
    el.classList.toggle("is-selected", el.dataset.chunkId === chunk.id);
  });

  const calendarEl = document.querySelector(`.event-chunk[data-chunk-id="${chunk.id}"]`);
  if (calendarEl) {
    document.querySelectorAll(".event-chunk.is-highlighted").forEach((el) => {
      el.classList.remove("is-highlighted");
    });
    calendarEl.classList.add("is-highlighted");
    calendarEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function toggleChunkCompletion(chunkId) {
  const target = scheduledChunks.find((ch) => ch.id === chunkId);
  if (!target) return;
  target.completed = !target.completed;
  if (target.completed) target.atRisk = false;
  renderAllViews(target);
}

function buildChunksFromUploadedFile(file, textContent) {
  const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
  const sizeKey = chunkLengthSelect.value;
  const durations =
    sizeKey === "5-10"
      ? [10, 10, 10, 10, 10, 5]
      : sizeKey === "15-20"
        ? [15, 20, 15, 20, 15, 15]
        : [10, 15, 10, 15, 10, 10];

  // Sample PDF #1: New Venture Pitch Deck
  if (/new[\s_-]*venture|pitch[\s_-]*deck/i.test(file.name)) {
    return {
      title: "New Venture Pitch Deck",
      chunks: [
        { title: "Define customer pain point & target market (15 pts)", duration: durations[0] },
        { title: "Map product features & value prop (20 pts)", duration: durations[1] },
        { title: "Compare top 3 competitors in matrix (15 pts)", duration: durations[2] },
        { title: "Build pricing tiers & startup costs (20 pts)", duration: durations[3] },
        { title: "Outline campus launch strategy (15 pts)", duration: durations[4] },
        { title: "Polish slides & rehearse 5-min pitch (15 pts)", duration: durations[5] }
      ]
    };
  }

  // Sample PDF #2: AI in Small Business Research Paper
  if (/ai[\s_-]*small[\s_-]*business|research[\s_-]*paper/i.test(file.name)) {
    return {
      title: "AI in Small Business Paper",
      chunks: [
        { title: "Lock thesis & intro context (15 pts)", duration: durations[0] },
        { title: "Synthesize 4+ peer-reviewed sources (20 pts)", duration: durations[1] },
        { title: "Analyze small-business AI case study (20 pts)", duration: durations[2] },
        { title: "Evaluate ROI, privacy & adoption risks (20 pts)", duration: durations[3] },
        { title: "Draft practical adoption recommendations (15 pts)", duration: durations[4] },
        { title: "Verify APA 7th citations & proofread (10 pts)", duration: durations[5] }
      ]
    };
  }

  // Sample PDF #3: Financial Management Midterm Study Guide
  if (/financial[\s_-]*management|study[\s_-]*guide|exam/i.test(file.name)) {
    return {
      title: "Financial Management Midterm",
      chunks: [
        { title: "Drill Time Value of Money (NPV/IRR) (20 pts)", duration: durations[0] },
        { title: "Review financial ratios & DuPont formula (15 pts)", duration: durations[1] },
        { title: "Practice bond valuation & YTM problems (15 pts)", duration: durations[2] },
        { title: "Review CAPM, beta & stock valuation (20 pts)", duration: durations[3] },
        { title: "Calculate WACC & capital budgeting (20 pts)", duration: durations[4] },
        { title: "Timed BA II Plus calculator mock quiz (10 pts)", duration: durations[5] }
      ]
    };
  }

  const targetDuration = sizeKey === "5-10" ? 10 : sizeKey === "15-20" ? 20 : 15;

  if (textContent && textContent.trim().length > 0) {
    const lines = textContent
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, "").trim())
      .filter((line) => line.length >= 6 && line.length <= 75)
      .slice(0, 6);

    if (lines.length >= 2) {
      return {
        title: cleanName,
        chunks: lines.map((line) => ({ title: line, duration: targetDuration }))
      };
    }
  }

  return {
    title: cleanName,
    chunks: [
      { title: "Review rubric criteria & prompt", duration: Math.max(5, targetDuration - 5) },
      { title: "Gather core sources & key data", duration: targetDuration },
      { title: "Draft primary analysis section", duration: targetDuration },
      { title: "Verify rubric checklist & polish", duration: Math.max(5, targetDuration - 5) }
    ]
  };
}

function handleFileSelection(file) {
  if (!file) return;
  presetButtons.forEach((btn) => btn.classList.remove("active"));
  uploadZone.classList.add("has-file");
  uploadTitle.textContent = file.name;
  uploadSubtitle.textContent = "Rubric ready · Click Break Down & Auto-Schedule";

  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      customUploadData = { file, textContent: e.target.result };
    };
    reader.readAsText(file);
  } else {
    customUploadData = { file, textContent: "" };
  }
}

/* =========================================
   Event Listeners
   ========================================= */
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

if (addAssignmentJumpBtn) {
  addAssignmentJumpBtn.addEventListener("click", () => switchView("scheduler"));
}

// Demo Clock Listeners
if (demoDaySelect) {
  demoDaySelect.addEventListener("change", () => {
    setSimulatedDateTime(Number(demoDaySelect.value), simMinutes);
  });
}

if (demoTimeInput) {
  demoTimeInput.addEventListener("change", () => {
    setSimulatedDateTime(simDayIndex, parseTimeInputToMinutes(demoTimeInput.value));
  });
}

if (jumpHourBtn) {
  jumpHourBtn.addEventListener("click", () => {
    if (simMinutes + 60 <= DAY_TOTAL_MINUTES - 30) {
      setSimulatedDateTime(simDayIndex, simMinutes + 60);
    } else if (simDayIndex < DAYS.length - 1) {
      setSimulatedDateTime(simDayIndex + 1, 30); // Roll to 8:30 AM next day
    } else {
      setSimulatedDateTime(simDayIndex, DAY_TOTAL_MINUTES - 15);
    }
  });
}

if (jumpDayBtn) {
  jumpDayBtn.addEventListener("click", () => {
    if (simDayIndex < DAYS.length - 1) {
      setSimulatedDateTime(simDayIndex + 1, 30); // Jump to 8:30 AM next day
    } else {
      updateClockStatusBadge("Already on Friday — end of demo week", "neutral");
    }
  });
}

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activePresetKey = btn.dataset.preset;
    customUploadData = null;

    presetButtons.forEach((b) => b.classList.toggle("active", b === btn));
    uploadZone.classList.remove("has-file");
    uploadTitle.textContent = "Drop assignment rubric here";
    uploadSubtitle.textContent = "PDF, DOCX, or TXT · or click to browse";
    dueDateInput.value = PRESETS[activePresetKey].defaultDue;
  });
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    uploadZone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    uploadZone.classList.remove("is-dragover");
  });
});

uploadZone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
});

scheduleForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const dueDateStr = dueDateInput.value;
  const sizeKey = chunkLengthSelect.value;

  let assignmentTitle;
  let rawChunks;

  if (customUploadData) {
    const parsed = buildChunksFromUploadedFile(
      customUploadData.file,
      customUploadData.textContent
    );
    assignmentTitle = parsed.title;
    rawChunks = parsed.chunks;
  } else {
    const preset = PRESETS[activePresetKey];
    assignmentTitle = preset.title;
    rawChunks = preset.chunksBySize[sizeKey];
  }

  const originalText = generateBtn.textContent;
  generateBtn.textContent = "Finding best schedule gaps...";
  generateBtn.disabled = true;

  setTimeout(() => {
    scheduledChunks = scheduledChunks.filter(
      (ch) => ch.assignmentTitle !== assignmentTitle
    );
    const addedChunks = scheduleAssignment(assignmentTitle, rawChunks, dueDateStr);
    lastSidebarAssignment = assignmentTitle;
    updateClockStatusBadge(`Scheduled ${addedChunks.length} chunks`, "update");
    renderAllViews(addedChunks[0]);

    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }, 350);
});

resetDemoBtn.addEventListener("click", () => {
  stopPhoneFocusTimer();
  scheduledChunks = [];
  customUploadData = null;
  lastSidebarAssignment = "";
  activePresetKey = "case-study";
  simDayIndex = 0;
  simMinutes = 30;

  presetButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.preset === activePresetKey)
  );
  dueDateInput.value = PRESETS[activePresetKey].defaultDue;
  chunkLengthSelect.value = "10-15";

  uploadZone.classList.remove("has-file");
  uploadTitle.textContent = "Drop assignment rubric here";
  uploadSubtitle.textContent = "PDF, DOCX, or TXT · or click to browse";
  fileInput.value = "";

  syncClockControlsUI();
  updateClockStatusBadge("Live auto-rescheduling active", "neutral");
  renderAllViews(null);
});

// Notification Controls & Timer Buttons
if (notifLeadTimeSelect) {
  notifLeadTimeSelect.addEventListener("change", () => renderNotificationsView(false));
}
if (notifToneSelect) {
  notifToneSelect.addEventListener("change", () => renderNotificationsView(false));
}
if (simulateNudgeBtn) {
  simulateNudgeBtn.addEventListener("click", () => renderNotificationsView(true));
}
if (timerToggleBtn) {
  timerToggleBtn.addEventListener("click", () => {
    timerPaused = !timerPaused;
    timerToggleBtn.textContent = timerPaused ? "Resume" : "Pause";
  });
}
if (timerCompleteBtn) {
  timerCompleteBtn.addEventListener("click", completeActiveTimerChunk);
}
if (timerCloseBtn) {
  timerCloseBtn.addEventListener("click", stopPhoneFocusTimer);
}

/* =========================================
   Initial Demo Load
   ========================================= */
function initDemo() {
  syncClockControlsUI();
  const initialPreset = PRESETS[activePresetKey];
  const initialChunks = scheduleAssignment(
    initialPreset.title,
    initialPreset.chunksBySize[chunkLengthSelect.value],
    initialPreset.defaultDue
  );
  lastSidebarAssignment = initialPreset.title;
  renderAllViews(initialChunks[0]);
}

initDemo();