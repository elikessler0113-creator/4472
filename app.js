/* =========================================
   Paced — Interactive Scheduler Prototype
   ========================================= */

// Calendar bounds: 8:00 AM (0 min) to 6:00 PM (600 min)
const DAY_START_HOUR = 8;
const DAY_TOTAL_MINUTES = 600;
const EVENT_BUFFER_MINUTES = 10;

const DAYS = [
  { key: "mon", label: "Mon", date: "2026-11-23" },
  { key: "tue", label: "Tue", date: "2026-11-24" },
  { key: "wed", label: "Wed", date: "2026-11-25" },
  { key: "thu", label: "Thu", date: "2026-11-26" },
  { key: "fri", label: "Fri", date: "2026-11-27" }
];

// Existing student class & work schedule (minutes since 8:00 AM)
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

// Preset assignment rubrics tailored by preferred chunk size
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
let customUploadData = null; // Holds parsed uploaded file if user drops one
let scheduledChunks = [];    // All micro-chunks currently placed on the calendar
let nextChunkId = 1;

// DOM References
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

/* =========================================
   Helpers: Time & Date Formatting
   ========================================= */
function formatMinutesToTime(minutesFromStart) {
  const totalMinutes = DAY_START_HOUR * 60 + minutesFromStart;
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
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

/* =========================================
   Core Gap-Finding Scheduler
   ========================================= */
function getOccupiedIntervals(dayKey) {
  const fixed = (FIXED_EVENTS[dayKey] || []).map((ev) => ({
    start: ev.start,
    end: ev.start + ev.duration
  }));

  const placed = scheduledChunks
    .filter((ch) => ch.day === dayKey)
    .map((ch) => ({
      start: ch.start,
      end: ch.start + ch.duration
    }));

  return [...fixed, ...placed].sort((a, b) => a.start - b.start);
}

/**
 * Finds the best available time slot on a given day for a chunk of `duration` minutes.
 * Prefers gaps between existing schedule blocks (e.g., between classes) before using
 * early morning or end-of-day windows.
 */
function findAvailableSlot(dayKey, duration) {
  const intervals = getOccupiedIntervals(dayKey);
  const candidateGaps = [];

  let cursor = 30; // Start looking at 8:30 AM so it feels realistic

  for (const block of intervals) {
    const gapStart = cursor;
    const gapEnd = block.start - EVENT_BUFFER_MINUTES;
    if (gapEnd - gapStart >= duration) {
      candidateGaps.push({
        start: gapStart,
        length: gapEnd - gapStart,
        isBetweenEvents: cursor > 30
      });
    }
    cursor = Math.max(cursor, block.end + EVENT_BUFFER_MINUTES);
  }

  // Remaining time after last event of the day
  if (DAY_TOTAL_MINUTES - cursor >= duration) {
    candidateGaps.push({
      start: cursor,
      length: DAY_TOTAL_MINUTES - cursor,
      isBetweenEvents: false
    });
  }

  if (candidateGaps.length === 0) return null;

  // Prefer gaps nestled between existing events so the demo clearly highlights "gap-filling"
  candidateGaps.sort((a, b) => {
    if (a.isBetweenEvents !== b.isBetweenEvents) {
      return a.isBetweenEvents ? -1 : 1;
    }
    return a.start - b.start;
  });

  // Snap start time to the nearest 5-minute increment
  const chosenStart = Math.ceil(candidateGaps[0].start / 5) * 5;
  return {
    start: chosenStart,
    gapLength: candidateGaps[0].length
  };
}

function getEligibleDays(dueDateStr) {
  const dueIndex = DAYS.findIndex((d) => d.date === dueDateStr);
  // If due date is within Mon–Fri, schedule up to that day; otherwise use full week
  if (dueIndex >= 0) {
    return DAYS.slice(0, dueIndex + 1);
  }
  return DAYS;
}

function scheduleAssignment(assignmentTitle, rawChunks, dueDateStr) {
  const eligibleDays = getEligibleDays(dueDateStr);
  const newlyScheduled = [];

  rawChunks.forEach((chunk, index) => {
    // Spread chunks round-robin across eligible days so work isn't crammed onto one day
    let placedSlot = null;
    let placedDay = null;

    for (let offset = 0; offset < eligibleDays.length; offset++) {
      const dayObj = eligibleDays[(index + offset) % eligibleDays.length];
      const slot = findAvailableSlot(dayObj.key, chunk.duration);
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
        title: chunk.title,
        duration: chunk.duration,
        day: placedDay.key,
        dayLabel: placedDay.label,
        start: placedSlot.start,
        gapLength: Math.min(placedSlot.gapLength, 60),
        completed: false,
        isNew: true
      };
      scheduledChunks.push(newChunk);
      newlyScheduled.push(newChunk);
    }
  });

  return newlyScheduled;
}

/* =========================================
   Rendering: Calendar, Sidebar & Nudge
   ========================================= */
function renderCalendar() {
  DAYS.forEach((dayObj) => {
    const col = document.querySelector(`.day-column[data-day="${dayObj.key}"]`);
    if (!col) return;
    col.innerHTML = "";

    // 1. Render Fixed Class & Work Events
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

    // 2. Render Scheduled Micro-Chunks
    const dayChunks = scheduledChunks.filter((ch) => ch.day === dayObj.key);
    dayChunks.forEach((chunk) => {
      const article = document.createElement("article");
      article.className = `event event-chunk${chunk.completed ? " is-completed" : ""}${chunk.isNew ? " is-pop-in" : ""}`;
      article.dataset.chunkId = chunk.id;
      article.style.setProperty("--start", chunk.start);
      article.style.setProperty("--duration", Math.max(chunk.duration, 15)); // Visual minimum for legibility
      article.title = `${chunk.assignmentTitle} • ${formatMinutesToTime(chunk.start)} (Click to mark complete)`;
      article.innerHTML = `
        <span class="event-title">${chunk.completed ? "✓ " : ""}${chunk.duration}m: ${chunk.title}</span>
      `;

      article.addEventListener("click", () => {
        toggleChunkCompletion(chunk.id);
      });

      col.appendChild(article);
    });
  });

  // Clear one-time entrance animation flag
  scheduledChunks.forEach((ch) => (ch.isNew = false));
}

function renderSidebarChunks(assignmentTitle, dueDateStr, chunksToDisplay) {
  const totalMinutes = chunksToDisplay.reduce((sum, ch) => sum + ch.duration, 0);
  chunkCountEl.textContent = `${chunksToDisplay.length} tasks · ${totalMinutes}m`;

  if (chunksToDisplay.length === 0) {
    assignmentMetaEl.innerHTML = `No micro-chunks scheduled yet. Choose a preset or drop a rubric above.`;
    chunkListEl.innerHTML = `<li class="chunk-empty">Calendar is clear of homework chunks.</li>`;
    return;
  }

  assignmentMetaEl.innerHTML = `<strong>${assignmentTitle}</strong> &middot; Due ${formatDueDateLabel(dueDateStr)}`;
  chunkListEl.innerHTML = "";

  chunksToDisplay.forEach((chunk) => {
    const li = document.createElement("li");
    li.className = `chunk-item is-scheduled${chunk.completed ? " is-completed" : ""}`;
    li.dataset.chunkId = chunk.id;
    li.innerHTML = `
      <div class="chunk-item-main">
        <span class="chunk-dot"></span>
        <span class="chunk-title">${chunk.title}</span>
      </div>
      <span class="chunk-duration">${chunk.dayLabel ? `${chunk.dayLabel} · ` : ""}${chunk.duration}m</span>
    `;

    li.addEventListener("click", () => {
      focusChunkOnCalendar(chunk);
    });

    chunkListEl.appendChild(li);
  });
}

function updateNotificationPreview(chunk) {
  if (!chunk) {
    statusDotEl.textContent = "Standby";
    toastTimeEl.textContent = "Waiting for schedule";
    toastBodyEl.innerHTML = `Add an assignment rubric to preview automated mobile reminders.`;
    return;
  }

  statusDotEl.textContent = chunk.completed ? "Completed" : "Scheduled";
  toastTimeEl.textContent = `${chunk.dayLabel} · ${formatMinutesToTime(chunk.start)}`;

  if (chunk.completed) {
    toastBodyEl.innerHTML = `Nice work! You finished <strong>${chunk.title} (${chunk.duration}m)</strong> ahead of your deadline.`;
  } else {
    const gapText = chunk.gapLength >= 30 ? "a free window" : `a ${chunk.gapLength}-minute gap`;
    toastBodyEl.innerHTML = `You have ${gapText} coming up. Knock out <strong>${chunk.title} (${chunk.duration}m)</strong> for ${chunk.assignmentTitle}?`;
  }
}

/* =========================================
   Interactions: Focus, Complete & Upload
   ========================================= */
function focusChunkOnCalendar(chunk) {
  updateNotificationPreview(chunk);

  // Highlight in sidebar
  document.querySelectorAll(".chunk-item").forEach((el) => {
    el.classList.toggle("is-selected", el.dataset.chunkId === chunk.id);
  });

  // Highlight and scroll to event on calendar
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
  renderCalendar();

  // Sync sidebar item visual state
  const sidebarItem = chunkListEl.querySelector(`.chunk-item[data-chunk-id="${chunkId}"]`);
  if (sidebarItem) {
    sidebarItem.classList.toggle("is-completed", target.completed);
  }

  updateNotificationPreview(target);
}

function buildChunksFromUploadedFile(file, textContent) {
  const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
  const targetDuration =
    chunkLengthSelect.value === "5-10" ? 10 : chunkLengthSelect.value === "15-20" ? 20 : 15;

  // If it's a readable .txt file with lines, pull real bullet/rubric items
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

  // Realistic fallback rubric breakdown for PDF/DOCX uploads during live demos
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

  // Deselect preset buttons to show custom upload is active
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

// Preset selection
presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activePresetKey = btn.dataset.preset;
    customUploadData = null;

    presetButtons.forEach((b) => b.classList.toggle("active", b === btn));
    uploadZone.classList.remove("has-file");
    uploadTitle.textContent = "Drop assignment rubric here";
    uploadSubtitle.textContent = "PDF, DOCX, or TXT · or click to browse";

    const preset = PRESETS[activePresetKey];
    dueDateInput.value = preset.defaultDue;
  });
});

// File input & Drag-and-Drop
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFileSelection(e.target.files[0]);
  }
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
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelection(files[0]);
  }
});

// Form Submit: Parse & Auto-Schedule
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

  // Brief button feedback to simulate rubric parsing during live demo
  const originalText = generateBtn.textContent;
  generateBtn.textContent = "Finding best schedule gaps...";
  generateBtn.disabled = true;

  setTimeout(() => {
    // Replace existing chunks from the same assignment if re-running it
    scheduledChunks = scheduledChunks.filter(
      (ch) => ch.assignmentTitle !== assignmentTitle
    );

    const addedChunks = scheduleAssignment(assignmentTitle, rawChunks, dueDateStr);
    renderCalendar();
    renderSidebarChunks(assignmentTitle, dueDateStr, addedChunks);

    if (addedChunks.length > 0) {
      updateNotificationPreview(addedChunks[0]);
    }

    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }, 350);
});

// Reset Demo Button (Clears homework chunks so you can demo live from a clean schedule)
resetDemoBtn.addEventListener("click", () => {
  scheduledChunks = [];
  customUploadData = null;
  activePresetKey = "case-study";

  presetButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.preset === activePresetKey)
  );
  dueDateInput.value = PRESETS[activePresetKey].defaultDue;
  chunkLengthSelect.value = "10-15";

  uploadZone.classList.remove("has-file");
  uploadTitle.textContent = "Drop assignment rubric here";
  uploadSubtitle.textContent = "PDF, DOCX, or TXT · or click to browse";
  fileInput.value = "";

  renderCalendar();
  renderSidebarChunks("", dueDateInput.value, []);
  updateNotificationPreview(null);
});

// Prevent dead nav link jumps in prototype
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => e.preventDefault());
});

/* =========================================
   Initial Demo Load
   ========================================= */
function initDemo() {
  const initialPreset = PRESETS[activePresetKey];
  const initialChunks = scheduleAssignment(
    initialPreset.title,
    initialPreset.chunksBySize[chunkLengthSelect.value],
    initialPreset.defaultDue
  );
  renderCalendar();
  renderSidebarChunks(initialPreset.title, initialPreset.defaultDue, initialChunks);
  if (initialChunks.length > 0) {
    updateNotificationPreview(initialChunks[0]);
  }
}

initDemo();