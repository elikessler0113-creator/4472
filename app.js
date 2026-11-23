/* =========================================
   Paced — Interactive Prototype Controller
   ========================================= */

// Paste your deployed Cloudflare Worker URL below:
const AI_WORKER_URL = "https://paced-rubric-ai.<your-subdomain>.workers.dev";
const AI_TIMEOUT_MS = 30000; // 30s timeout for PDF analysis
const MAX_AI_FILE_BYTES = 10 * 1024 * 1024; // 10 MB safety cap

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

// Application State
let selectedRubricFile = null;
let scheduledChunks = [];
let lastSidebarAssignment = "";
let recentRescueNotices = [];
let nextChunkId = 1;

// Simulated Clock State (Default: Mon Nov 23 at 8:30 AM)
let simDayIndex = 0;
let simMinutes = 30;

// Phone Focus Timer State
let activeTimerChunkId = null;
let timerSecondsRemaining = 0;
let timerInterval = null;
let timerPaused = false;

// DOM References — Topbar & Theme
const navLinks = document.querySelectorAll(".nav-link[data-view]");
const viewPanels = {
  scheduler: document.getElementById("view-scheduler"),
  assignments: document.getElementById("view-assignments"),
  notifications: document.getElementById("view-notifications")
};
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeIconEl = document.getElementById("theme-icon");
const themeLabelEl = document.getElementById("theme-label");
const resetDemoBtn = document.getElementById("reset-demo-btn");

// DOM References — Scheduler & Demo Clock
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("rubric-file");
const uploadTitle = uploadZone.querySelector(".upload-title");
const uploadSubtitle = uploadZone.querySelector(".upload-subtitle");
const scheduleForm = document.getElementById("schedule-form");
const dueDateInput = document.getElementById("due-date");
const chunkLengthSelect = document.getElementById("chunk-length");
const generateBtn = document.getElementById("generate-btn");

const chunkCountEl = document.getElementById("chunk-count");
const assignmentMetaEl = document.querySelector(".assignment-meta");
const chunkListEl = document.getElementById("chunk-list");
const toastTimeEl = document.querySelector(".toast-time");
const toastBodyEl = document.querySelector(".toast-body");
const statusDotEl = document.querySelector(".status-dot");

const calPrevDayBtn = document.getElementById("cal-prev-day-btn");
const calTodayBtn = document.getElementById("cal-today-btn");
const calNextDayBtn = document.getElementById("cal-next-day-btn");
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

// DOM References — Notifications View & Phone Clock
const notifDaySelect = document.getElementById("notif-day-select");
const notifTimeInput = document.getElementById("notif-time-input");
const notifJump15mBtn = document.getElementById("notif-jump-15m");
const notifJump1hBtn = document.getElementById("notif-jump-1h");
const notifJumpNextBtn = document.getElementById("notif-jump-next");
const notifClockStatusEl = document.getElementById("notif-clock-status");

const notifLeadTimeSelect = document.getElementById("notif-lead-time");
const notifToneSelect = document.getElementById("notif-tone");
const notifQuietHoursCheckbox = document.getElementById("notif-quiet-hours");
const notifSmartGapsCheckbox = document.getElementById("notif-smart-gaps");
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
   Theme (Light / Dark Mode)
   ========================================= */
function applyTheme(theme) {
  const isDark = theme === "dark";
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  }
  if (themeIconEl) {
    themeIconEl.innerHTML = isDark ? "&#9728;" : "&#9790;";
  }
  if (themeLabelEl) {
    themeLabelEl.textContent = isDark ? "Light" : "Dark";
  }

  try {
    localStorage.setItem("paced-theme", theme);
  } catch (e) {}
}

function initTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "dark" : "light");
}

/* =========================================
   Helpers: Time, Date & View Switching
   ========================================= */
function getDayIndexByKey(dayKey) {
  return DAYS.findIndex((d) => d.key === dayKey);
}

function getLeadMinutes() {
  return Number(notifLeadTimeSelect ? notifLeadTimeSelect.value : 5);
}

function isSmartGapRescueEnabled() {
  return notifSmartGapsCheckbox ? notifSmartGapsCheckbox.checked : true;
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
  if (viewName === "notifications") renderNotificationsView(false);
}

function updateClockStatusBadge(message, tone = "neutral") {
  [rescheduleStatusEl, notifClockStatusEl].forEach((el) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("has-update", "has-warning");
    if (tone === "update") el.classList.add("has-update");
    if (tone === "warning") el.classList.add("has-warning");
  });
}

function syncClockControlsUI() {
  const dayVal = String(simDayIndex);
  const timeVal = formatMinutesTo24hInput(simMinutes);

  if (demoDaySelect) demoDaySelect.value = dayVal;
  if (demoTimeInput) demoTimeInput.value = timeVal;
  if (notifDaySelect) notifDaySelect.value = dayVal;
  if (notifTimeInput) notifTimeInput.value = timeVal;

  const displayClock = formatMinutesToTime(simMinutes).replace(/ [AP]M/, "");
  if (phoneScreenClockEl) phoneScreenClockEl.textContent = displayClock;
  if (phoneBigTimeEl) phoneBigTimeEl.textContent = displayClock;
  if (phoneDateEl) phoneDateEl.textContent = DAYS[simDayIndex].fullLabel;
}

function getActiveFixedEventNow() {
  const dayKey = DAYS[simDayIndex].key;
  const events = FIXED_EVENTS[dayKey] || [];
  return events.find((ev) => simMinutes >= ev.start && simMinutes < ev.start + ev.duration) || null;
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

function rescheduleMissedChunks() {
  recentRescueNotices = [];

  const missed = scheduledChunks
    .filter((ch) => {
      if (ch.completed) return false;
      const chDayIdx = getDayIndexByKey(ch.day);
      return (
        chDayIdx < simDayIndex ||
        (chDayIdx === simDayIndex && ch.start + ch.duration <= simMinutes)
      );
    })
    .sort((a, b) => {
      const dayDiff = getDayIndexByKey(a.day) - getDayIndexByKey(b.day);
      return dayDiff !== 0 ? dayDiff : a.start - b.start;
    });

  if (missed.length === 0) {
    return { movedCount: 0, atRiskCount: 0 };
  }

  if (!isSmartGapRescueEnabled()) {
    missed.forEach((ch) => {
      ch.atRisk = true;
    });
    return { movedCount: 0, atRiskCount: missed.length };
  }

  let movedCount = 0;
  let atRiskCount = 0;

  missed.forEach((chunk) => {
    const dueIdx = DAYS.findIndex((d) => d.date === chunk.dueDate);
    const maxPreferredIdx = dueIdx >= simDayIndex ? dueIdx : DAYS.length - 1;

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
      recentRescueNotices.push({
        title: chunk.title,
        newDayLabel: newDay.label,
        newTime: formatMinutesToTime(newSlot.start)
      });
    } else {
      chunk.atRisk = true;
      atRiskCount += 1;
    }
  });

  return { movedCount, atRiskCount };
}

function setSimulatedDateTime(newDayIndex, newMinutes, { pingNotification = false } = {}) {
  simDayIndex = Math.max(0, Math.min(DAYS.length - 1, newDayIndex));
  simMinutes = Math.max(0, Math.min(DAY_TOTAL_MINUTES - 15, newMinutes));

  syncClockControlsUI();
  const { movedCount, atRiskCount } = rescheduleMissedChunks();

  const immediateNow = getImmediateActiveChunks();
  const nextFuture = getNextFutureChunk();

  if (atRiskCount > 0) {
    const label = isSmartGapRescueEnabled()
      ? `${atRiskCount} chunk${atRiskCount > 1 ? "s" : ""} out of weekly gaps`
      : `${atRiskCount} missed chunk${atRiskCount > 1 ? "s" : ""} (Smart Rescue off)`;
    updateClockStatusBadge(label, "warning");
  } else if (movedCount > 0) {
    updateClockStatusBadge(
      `Auto-rescheduled ${movedCount} missed chunk${movedCount > 1 ? "s" : ""}`,
      "update"
    );
  } else if (immediateNow.length > 0) {
    updateClockStatusBadge(
      `${immediateNow.length} nudge${immediateNow.length > 1 ? "s" : ""} active right now`,
      "update"
    );
  } else if (nextFuture) {
    const triggerAt = Math.max(0, nextFuture.start - getLeadMinutes());
    updateClockStatusBadge(
      `Next nudge: ${nextFuture.dayLabel} ${formatMinutesToTime(triggerAt)}`,
      "neutral"
    );
  } else {
    updateClockStatusBadge(
      `Clock set to ${DAYS[simDayIndex].label} ${formatMinutesToTime(simMinutes)}`,
      "neutral"
    );
  }

  renderAllViews(immediateNow[0] || nextFuture || null, pingNotification);
}

function advanceSimulatedTime(deltaMinutes) {
  let targetDay = simDayIndex;
  let targetMin = simMinutes + deltaMinutes;

  if (targetMin > DAY_TOTAL_MINUTES - 15) {
    if (targetDay < DAYS.length - 1) {
      targetDay += 1;
      targetMin = 30;
    } else {
      targetMin = DAY_TOTAL_MINUTES - 15;
    }
  }

  setSimulatedDateTime(targetDay, targetMin);
}

function jumpToNextNudge() {
  const lead = getLeadMinutes();
  const upcoming = getUpcomingIncompleteChunks();

  const nextChunk = upcoming.find((ch) => {
    const dayIdx = getDayIndexByKey(ch.day);
    const triggerMin = Math.max(0, ch.start - lead);
    return dayIdx > simDayIndex || (dayIdx === simDayIndex && triggerMin > simMinutes);
  });

  if (nextChunk) {
    const targetDayIdx = getDayIndexByKey(nextChunk.day);
    const targetMin = Math.max(0, nextChunk.start - lead);
    setSimulatedDateTime(targetDayIdx, targetMin, { pingNotification: true });
    return;
  }

  if (getImmediateActiveChunks().length > 0) {
    updateClockStatusBadge("Nudge is active now — start, snooze, or +1 Hr", "update");
    renderNotificationsView(true);
  } else {
    updateClockStatusBadge("No upcoming nudges left this week", "neutral");
  }
}

function getUpcomingIncompleteChunks() {
  return scheduledChunks
    .filter((ch) => !ch.completed)
    .sort((a, b) => {
      const dayDiff = getDayIndexByKey(a.day) - getDayIndexByKey(b.day);
      return dayDiff !== 0 ? dayDiff : a.start - b.start;
    });
}

function getImmediateActiveChunks() {
  const lead = getLeadMinutes();
  const currentDayKey = DAYS[simDayIndex].key;

  return getUpcomingIncompleteChunks().filter((ch) => {
    if (ch.day !== currentDayKey) return false;
    const triggerMin = Math.max(0, ch.start - lead);
    return simMinutes >= triggerMin && simMinutes < ch.start + ch.duration;
  });
}

function getNextFutureChunk() {
  const lead = getLeadMinutes();
  return (
    getUpcomingIncompleteChunks().find((ch) => {
      const dayIdx = getDayIndexByKey(ch.day);
      const triggerMin = Math.max(0, ch.start - lead);
      return dayIdx > simDayIndex || (dayIdx === simDayIndex && triggerMin > simMinutes);
    }) || null
  );
}

/* =========================================
   Rendering: All Synced Views
   ========================================= */
function renderAllViews(highlightChunk = null, pingPhone = false) {
  renderCalendar();
  renderSidebarForCurrentAssignment();
  renderAssignmentsView();
  renderNotificationsView(pingPhone);

  const nextPending =
    highlightChunk ||
    getImmediateActiveChunks()[0] ||
    getNextFutureChunk() ||
    getUpcomingIncompleteChunks()[0] ||
    scheduledChunks[0] ||
    null;
  updateNotificationPreview(nextPending);
}

function renderCalendar() {
  const dayHeaders = document.querySelectorAll(".day-header");
  dayHeaders.forEach((header, idx) => {
    header.classList.toggle("is-today", idx === simDayIndex);
  });

  DAYS.forEach((dayObj, dayIdx) => {
    const col = document.querySelector(`.day-column[data-day="${dayObj.key}"]`);
    if (!col) return;
    col.innerHTML = "";

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
      "No micro-chunks scheduled yet. Upload or drop an assignment rubric above.";
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
      "Upload an assignment rubric to preview automated mobile reminders.";
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
        <p style="margin-top: 0.4rem;">Upload or drop a rubric file in the Scheduler to get started.</p>
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
          <p class="assignment-card-sub">
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
   View 3: Real-Time Phone Lock Screen & Timer
   ========================================= */
function buildNudgeCopy(chunk) {
  const tone = notifToneSelect ? notifToneSelect.value : "encouraging";
  const minsUntil = Math.max(0, chunk.start - simMinutes);
  const timingLabel = minsUntil === 0 ? "right now" : `in ${minsUntil} min`;

  if (tone === "direct") {
    return `Starts ${timingLabel} (${chunk.duration}m): <strong>${chunk.title}</strong> — ${chunk.assignmentTitle}.`;
  }
  if (tone === "accountability") {
    return `Stay ahead of your ${formatDueDateLabel(chunk.dueDate)} deadline. Start <strong>${chunk.title} (${chunk.duration}m)</strong> ${timingLabel}.`;
  }
  if (chunk.rescheduled) {
    return `Rescheduled gap opens ${timingLabel}! Ready for a quick ${chunk.duration}m win on <strong>${chunk.title}</strong>?`;
  }
  return `Quick ${chunk.duration}-minute gap ${timingLabel}! Knock out <strong>${chunk.title}</strong> before your next block.`;
}

function buildPhoneNotifCard(chunk, badgeText, highlight = false) {
  const card = document.createElement("div");
  card.className = `phone-notif-card${highlight ? " is-live-ping" : ""}`;
  card.innerHTML = `
    <div class="phone-notif-top">
      <span class="phone-notif-app">Paced</span>
      <span>${badgeText}</span>
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

  return card;
}

function renderNotificationsView(forceTestPing = false) {
  if (!phoneNotificationStack) return;

  phoneNotificationStack.innerHTML = "";

  const quietModeEnabled = notifQuietHoursCheckbox ? notifQuietHoursCheckbox.checked : true;
  const activeFixedEvent = getActiveFixedEventNow();
  const immediateChunks = getImmediateActiveChunks();
  const nextFuture = getNextFutureChunk();

  if (recentRescueNotices.length > 0) {
    const notice = recentRescueNotices[0];
    const extraCount = recentRescueNotices.length - 1;
    const rescueCard = document.createElement("div");
    rescueCard.className = "phone-notif-card is-rescued";
    rescueCard.innerHTML = `
      <div class="phone-notif-top">
        <span class="phone-notif-app">Paced &middot; Smart Rescue</span>
        <span>just now</span>
      </div>
      <p class="phone-notif-msg" style="margin-bottom: 0;">
        Moved missed chunk <strong>${notice.title}</strong> to <strong>${notice.newDayLabel} at ${notice.newTime}</strong>${extraCount > 0 ? ` (+${extraCount} more)` : ""}.
      </p>
    `;
    phoneNotificationStack.appendChild(rescueCard);
  }

  if (quietModeEnabled && activeFixedEvent && !forceTestPing) {
    const quietCard = document.createElement("div");
    quietCard.className = "phone-quiet-card";
    quietCard.innerHTML = `
      <p class="phone-quiet-title">Notifications Muted</p>
      <p class="phone-quiet-sub">
        In <strong>${activeFixedEvent.title}</strong> until ${formatMinutesToTime(activeFixedEvent.start + activeFixedEvent.duration)}.
        ${nextFuture ? `<br />Next nudge queued for ${nextFuture.dayLabel} at ${formatMinutesToTime(Math.max(0, nextFuture.start - getLeadMinutes()))}.` : ""}
      </p>
    `;
    phoneNotificationStack.appendChild(quietCard);
    return;
  }

  if (immediateChunks.length > 0) {
    immediateChunks.forEach((chunk, idx) => {
      const minsUntil = chunk.start - simMinutes;
      const badge = minsUntil > 0 ? `in ${minsUntil}m` : "now";
      phoneNotificationStack.appendChild(
        buildPhoneNotifCard(chunk, badge, forceTestPing || idx === 0)
      );
    });
    return;
  }

  if (forceTestPing && nextFuture) {
    phoneNotificationStack.appendChild(
      buildPhoneNotifCard(
        nextFuture,
        `Preview · ${nextFuture.dayLabel} ${formatMinutesToTime(nextFuture.start)}`,
        true
      )
    );
    return;
  }

  const standbyCard = document.createElement("div");
  standbyCard.className = "phone-quiet-card";
  if (nextFuture) {
    const nextTrigger = formatMinutesToTime(Math.max(0, nextFuture.start - getLeadMinutes()));
    standbyCard.innerHTML = `
      <p class="phone-quiet-title">No nudges right now</p>
      <p class="phone-quiet-sub">
        Paced only buzzes right before an open gap.<br />
        Next reminder: <strong>${nextFuture.dayLabel} at ${nextTrigger}</strong>.
      </p>
    `;
  } else {
    standbyCard.innerHTML = `
      <p class="phone-quiet-title">All caught up</p>
      <p class="phone-quiet-sub">No pending homework chunks left on your calendar.</p>
    `;
  }
  phoneNotificationStack.appendChild(standbyCard);
}

function snoozeChunk(chunkId) {
  const target = scheduledChunks.find((ch) => ch.id === chunkId);
  if (!target) return;

  const currentIdx = getDayIndexByKey(target.day);
  const minSameDay = Math.max(
    target.start + 15,
    currentIdx === simDayIndex ? simMinutes + 15 : 30
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

  recentRescueNotices = [
    {
      title: target.title,
      newDayLabel: target.dayLabel,
      newTime: formatMinutesToTime(target.start)
    }
  ];
  updateClockStatusBadge(
    `Snoozed to ${target.dayLabel} ${formatMinutesToTime(target.start)}`,
    "update"
  );
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
  recentRescueNotices = [];
  stopPhoneFocusTimer();
  renderAllViews(target);
}

/* =========================================
   Interactions: Focus, Toggle & Rubric Parsing
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

function readFilePayload(file) {
  return new Promise((resolve) => {
    const lowerName = file.name.toLowerCase();

    if (file.type === "text/plain" || lowerName.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          file,
          mimeType: "text/plain",
          textContent: String(e.target.result || ""),
          base64Data: "",
          tooLarge: false
        });
      };
      reader.onerror = () => {
        resolve({
          file,
          mimeType: "text/plain",
          textContent: "",
          base64Data: "",
          tooLarge: false
        });
      };
      reader.readAsText(file);
      return;
    }

    if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
      if (file.size > MAX_AI_FILE_BYTES) {
        resolve({
          file,
          mimeType: "application/pdf",
          textContent: "",
          base64Data: "",
          tooLarge: true
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const resultStr = String(e.target.result || "");
        const base64 = resultStr.includes(",") ? resultStr.split(",")[1] : "";
        resolve({
          file,
          mimeType: "application/pdf",
          textContent: "",
          base64Data: base64,
          tooLarge: false
        });
      };
      reader.onerror = () => {
        resolve({
          file,
          mimeType: "application/pdf",
          textContent: "",
          base64Data: "",
          tooLarge: false
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // .docx / other formats use the local rubric parser
    resolve({
      file,
      mimeType: file.type || "",
      textContent: "",
      base64Data: "",
      tooLarge: false
    });
  });
}

async function parseRubricWithAI(payload, chunkSize) {
  if (!AI_WORKER_URL || AI_WORKER_URL.includes("<your-subdomain>")) {
    return { data: null, reason: "Worker URL not set in app.js" };
  }

  if (payload.tooLarge) {
    return { data: null, reason: "PDF exceeds 10 MB limit" };
  }

  const isSupported =
    (payload.mimeType === "application/pdf" && payload.base64Data.length > 0) ||
    (payload.mimeType === "text/plain" && payload.textContent.trim().length > 0);

  if (!isSupported) {
    return { data: null, reason: "Local parser used for non-PDF file" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(AI_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        fileName: payload.file.name,
        mimeType: payload.mimeType,
        base64Data: payload.base64Data,
        textContent: payload.textContent,
        chunkSize
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI Worker error:", res.status, errText);
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) detail = errJson.error;
      } catch (e) {}
      return { data: null, reason: `AI error: ${detail}` };
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.chunks) || data.chunks.length === 0) {
      return { data: null, reason: "AI returned no chunks" };
    }

    return {
      data: {
        title: String(data.title || payload.file.name).trim(),
        chunks: data.chunks.map((c) => ({
          title: String(c.title || "Work block").trim(),
          duration: Number(c.duration) || 15
        }))
      },
      reason: ""
    };
  } catch (err) {
    console.error("AI fetch failed:", err);
    const reason =
      err.name === "AbortError" ? "AI timed out" : "Worker unreachable / CORS";
    return { data: null, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildChunksFromUploadedFile(file, textContent) {
  const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
  const sizeKey = chunkLengthSelect.value;

  // Actual Course Rubric: 4472/5472 Project Presentation (Grading Template- Presentation.docx)
  if (/grading[\s_-]*template|presentation|4472/i.test(file.name)) {
    const weightedDurations =
      sizeKey === "5-10"
        ? [10, 5, 10, 10, 10, 5, 10, 10]
        : sizeKey === "15-20"
          ? [15, 15, 20, 20, 20, 15, 20, 15]
          : [15, 10, 15, 15, 15, 10, 15, 15];

    return {
      title: "4472 Project Presentation",
      chunks: [
        { title: "Opening, opportunity & target markets (Wt 2)", duration: weightedDurations[0] },
        { title: "Define product/service & MVBP slides (Wt 1)", duration: weightedDurations[1] },
        { title: "Build & test live product prototype (Wt 4)", duration: weightedDurations[2] },
        { title: "Rehearse live prototype demo flow (Wt 4)", duration: weightedDurations[3] },
        { title: "Business Model & Osterwalder Canvas (7 marks)", duration: weightedDurations[4] },
        { title: "Outline marketing & selling strategy (Wt 1)", duration: weightedDurations[5] },
        { title: "Model Price, LTA, COCA & Profit (Wt 2)", duration: weightedDurations[6] },
        { title: "Polish slides, print Canvas & Q&A prep (Wt 2)", duration: weightedDurations[7] }
      ]
    };
  }

  const durations =
    sizeKey === "5-10"
      ? [10, 10, 10, 10, 10, 5]
      : sizeKey === "15-20"
        ? [15, 20, 15, 20, 15, 15]
        : [10, 15, 10, 15, 10, 10];

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
  selectedRubricFile = file;
  uploadZone.classList.remove("is-error");
  uploadZone.classList.add("has-file");
  uploadTitle.textContent = file.name;
  uploadSubtitle.textContent = "Rubric ready · Click Break Down & Auto-Schedule";
}

/* =========================================
   Event Listeners
   ========================================= */
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

if (addAssignmentJumpBtn) {
  addAssignmentJumpBtn.addEventListener("click", () => switchView("scheduler"));
}

// Calendar Toolbar Navigation
if (calPrevDayBtn) {
  calPrevDayBtn.addEventListener("click", () => {
    if (simDayIndex > 0) {
      setSimulatedDateTime(simDayIndex - 1, simMinutes);
    }
  });
}

if (calNextDayBtn) {
  calNextDayBtn.addEventListener("click", () => {
    if (simDayIndex < DAYS.length - 1) {
      setSimulatedDateTime(simDayIndex + 1, simMinutes);
    }
  });
}

if (calTodayBtn) {
  calTodayBtn.addEventListener("click", () => {
    const nowLine = document.querySelector(".now-line");
    if (nowLine) {
      nowLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

// Scheduler Clock Listeners
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
  jumpHourBtn.addEventListener("click", () => advanceSimulatedTime(60));
}

if (jumpDayBtn) {
  jumpDayBtn.addEventListener("click", () => {
    if (simDayIndex < DAYS.length - 1) {
      setSimulatedDateTime(simDayIndex + 1, 30);
    } else {
      updateClockStatusBadge("Already on Friday — end of demo week", "neutral");
    }
  });
}

// Notifications Phone Clock Listeners
if (notifDaySelect) {
  notifDaySelect.addEventListener("change", () => {
    setSimulatedDateTime(Number(notifDaySelect.value), simMinutes);
  });
}

if (notifTimeInput) {
  notifTimeInput.addEventListener("change", () => {
    setSimulatedDateTime(simDayIndex, parseTimeInputToMinutes(notifTimeInput.value));
  });
}

if (notifJump15mBtn) {
  notifJump15mBtn.addEventListener("click", () => advanceSimulatedTime(15));
}

if (notifJump1hBtn) {
  notifJump1hBtn.addEventListener("click", () => advanceSimulatedTime(60));
}

if (notifJumpNextBtn) {
  notifJumpNextBtn.addEventListener("click", jumpToNextNudge);
}

// File Upload & Scheduling Form
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

scheduleForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedRubricFile) {
    uploadZone.classList.add("is-error");
    uploadSubtitle.textContent = "Please select or drop a rubric file first";
    return;
  }

  const dueDateStr = dueDateInput.value;
  const sizeKey = chunkLengthSelect.value;
  const originalText = generateBtn.textContent;
  generateBtn.textContent = "AI reading rubric & finding gaps...";
  generateBtn.disabled = true;

  try {
    const payload = await readFilePayload(selectedRubricFile);
    const aiResult = await parseRubricWithAI(payload, sizeKey);
    const usedLiveAI = Boolean(aiResult.data);
    const parsed =
      aiResult.data || buildChunksFromUploadedFile(payload.file, payload.textContent);

    scheduledChunks = scheduledChunks.filter(
      (ch) => ch.assignmentTitle !== parsed.title
    );
    const addedChunks = scheduleAssignment(parsed.title, parsed.chunks, dueDateStr);
    lastSidebarAssignment = parsed.title;
    recentRescueNotices = [];

    updateClockStatusBadge(
      usedLiveAI
        ? `AI parsed & scheduled ${addedChunks.length} chunks`
        : `Fallback (${aiResult.reason})`,
      usedLiveAI ? "update" : "warning"
    );
    renderAllViews(addedChunks[0]);
  } finally {
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
});

resetDemoBtn.addEventListener("click", () => {
  stopPhoneFocusTimer();
  scheduledChunks = [];
  selectedRubricFile = null;
  lastSidebarAssignment = "";
  recentRescueNotices = [];
  simDayIndex = 0;
  simMinutes = 30;

  dueDateInput.value = "2026-11-27";
  chunkLengthSelect.value = "10-15";

  uploadZone.classList.remove("has-file", "is-error");
  uploadTitle.textContent = "Drop assignment rubric here";
  uploadSubtitle.textContent = "PDF, DOCX, or TXT · or click to browse";
  fileInput.value = "";

  syncClockControlsUI();
  updateClockStatusBadge("Live auto-rescheduling active", "neutral");
  renderAllViews(null);
});

// Notification Settings & Timer Controls
if (notifLeadTimeSelect) {
  notifLeadTimeSelect.addEventListener("change", () => renderNotificationsView(false));
}
if (notifToneSelect) {
  notifToneSelect.addEventListener("change", () => renderNotificationsView(false));
}
if (notifQuietHoursCheckbox) {
  notifQuietHoursCheckbox.addEventListener("change", () => renderNotificationsView(false));
}
if (notifSmartGapsCheckbox) {
  notifSmartGapsCheckbox.addEventListener("change", () => {
    if (notifSmartGapsCheckbox.checked) {
      setSimulatedDateTime(simDayIndex, simMinutes);
    }
  });
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
   Initial Load
   ========================================= */
function initDemo() {
  initTheme();
  syncClockControlsUI();
  updateClockStatusBadge("Live auto-rescheduling active", "neutral");
  renderAllViews(null);
}

initDemo();