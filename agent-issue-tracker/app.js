(function () {
  "use strict";

  const STORAGE_ISSUES = "ait-issues-v1";
  const STORAGE_BUDGET = "ait-budget-cap-v1";
  const STORAGE_DENSITY = "ait-density-v1";

  const STATUSES = [
    { id: "backlog", label: "Backlog" },
    { id: "ready", label: "Ready" },
    { id: "in_progress", label: "In progress" },
    { id: "blocked", label: "Blocked" },
    { id: "done", label: "Done" },
  ];

  const PRIORITIES = [
    { id: "p0", label: "P0 — Critical" },
    { id: "p1", label: "P1 — High" },
    { id: "p2", label: "P2 — Normal" },
    { id: "p3", label: "P3 — Low" },
  ];

  const AUDIENCES = [
    { id: "human", label: "Human" },
    { id: "agent", label: "Agent" },
    { id: "both", label: "Human + agent" },
  ];

  const PRIORITY_ORDER = { p0: 0, p1: 1, p2: 2, p3: 3 };

  /** @typedef {{ id: string, title: string, description: string, status: string, priority: string, audience: string, estimatedTokens: number, timeBudgetMin: number, labels: string[], createdAt: string, updatedAt: string }} Issue */

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function loadIssues() {
    try {
      const raw = localStorage.getItem(STORAGE_ISSUES);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map(normalizeIssue).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveIssues(/** @type {Issue[]} */ issues) {
    localStorage.setItem(STORAGE_ISSUES, JSON.stringify(issues));
  }

  function normalizeIssue(obj) {
    if (!obj || typeof obj !== "object") return null;
    const id = typeof obj.id === "string" ? obj.id : uid();
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const description = typeof obj.description === "string" ? obj.description : "";
    const status = STATUSES.some((s) => s.id === obj.status) ? obj.status : "backlog";
    const priority = PRIORITIES.some((p) => p.id === obj.priority) ? obj.priority : "p2";
    const audience = AUDIENCES.some((a) => a.id === obj.audience) ? obj.audience : "both";
    const estimatedTokens = Math.max(0, Number(obj.estimatedTokens) || 0);
    const timeBudgetMin = Math.max(0, Number(obj.timeBudgetMin) || 0);
    let labels = [];
    if (Array.isArray(obj.labels)) {
      labels = obj.labels.map(String).map((s) => s.trim()).filter(Boolean);
    } else if (typeof obj.labels === "string") {
      labels = obj.labels.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : nowIso();
    const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : createdAt;
    return {
      id,
      title,
      description,
      status,
      priority,
      audience,
      estimatedTokens,
      timeBudgetMin,
      labels,
      createdAt,
      updatedAt,
    };
  }

  /** @type {Issue[]} */
  let issues = loadIssues();

  const filterState = {
    search: "",
    status: /** @type {Set<string>} */ (new Set()),
    priority: /** @type {Set<string>} */ (new Set()),
    audience: /** @type {Set<string>} */ (new Set()),
    sort: "updated-desc",
  };

  const els = {
    issueList: document.getElementById("issue-list"),
    emptyState: document.getElementById("empty-state"),
    resultsCount: document.getElementById("results-count"),
    budgetCap: document.getElementById("budget-cap"),
    budgetMeter: document.getElementById("budget-meter"),
    budgetMeterFill: document.getElementById("budget-meter-fill"),
    budgetMeterLabel: document.querySelector("#budget-meter .budget-meter__label"),
    statEstimated: document.getElementById("stat-estimated"),
    statOpen: document.getElementById("stat-open"),
    filterSearch: document.getElementById("filter-search"),
    filterStatus: document.getElementById("filter-status"),
    filterPriority: document.getElementById("filter-priority"),
    filterAudience: document.getElementById("filter-audience"),
    filterSort: document.getElementById("filter-sort"),
    btnClearFilters: document.getElementById("btn-clear-filters"),
    btnNewIssue: document.getElementById("btn-new-issue"),
    btnExport: document.getElementById("btn-export"),
    importFile: document.getElementById("import-file"),
    btnImportTrigger: document.getElementById("btn-import-trigger"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalClose: document.getElementById("modal-close"),
    issueForm: document.getElementById("issue-form"),
    issueId: document.getElementById("issue-id"),
    issueTitle: document.getElementById("issue-title"),
    issueDescription: document.getElementById("issue-description"),
    issueStatus: document.getElementById("issue-status"),
    issuePriority: document.getElementById("issue-priority"),
    issueAudience: document.getElementById("issue-audience"),
    issueTokens: document.getElementById("issue-tokens"),
    issueTime: document.getElementById("issue-time"),
    issueLabels: document.getElementById("issue-labels"),
    btnDeleteIssue: document.getElementById("btn-delete-issue"),
    btnCancel: document.getElementById("btn-cancel"),
    main: document.getElementById("main"),
    toastRegion: document.getElementById("toast-region"),
  };

  function fillSelect(select, items) {
    select.innerHTML = "";
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.label;
      select.appendChild(opt);
    });
  }

  function buildFilterChips(container, items, group) {
    container.innerHTML = "";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = item.label;
      btn.setAttribute("aria-pressed", "false");
      btn.dataset.value = item.id;
      btn.addEventListener("click", () => {
        const set = filterState[group];
        if (set.has(item.id)) {
          set.delete(item.id);
          btn.setAttribute("aria-pressed", "false");
        } else {
          set.add(item.id);
          btn.setAttribute("aria-pressed", "true");
        }
        render();
      });
      container.appendChild(btn);
    });
  }

  function syncChipUI() {
    /** @param {HTMLElement} container @param {string} group */
    function sync(container, group) {
      const set = filterState[group];
      container.querySelectorAll(".chip").forEach((chip) => {
        const el = /** @type {HTMLButtonElement} */ (chip);
        const v = el.dataset.value;
        el.setAttribute("aria-pressed", set.has(v) ? "true" : "false");
      });
    }
    sync(els.filterStatus, "status");
    sync(els.filterPriority, "priority");
    sync(els.filterAudience, "audience");
  }

  function toast(message) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    els.toastRegion.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function openIssuesExport() {
    const blob = new Blob([JSON.stringify(issues, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent-issues-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported issues as JSON.");
  }

  function importIssuesFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const arr = Array.isArray(data) ? data : data.issues;
        if (!Array.isArray(arr)) throw new Error("Invalid format");
        const merged = arr.map(normalizeIssue).filter(Boolean);
        if (!merged.length) throw new Error("No valid issues");
        issues = merged;
        saveIssues(issues);
        render();
        toast("Imported " + merged.length + " issues.");
      } catch (e) {
        toast("Import failed: check JSON structure.");
        console.error(e);
      }
    };
    reader.readAsText(file);
  }

  function getFilteredSorted() {
    const q = filterState.search.trim().toLowerCase();
    let list = issues.slice();

    if (filterState.status.size) {
      list = list.filter((i) => filterState.status.has(i.status));
    }
    if (filterState.priority.size) {
      list = list.filter((i) => filterState.priority.has(i.priority));
    }
    if (filterState.audience.size) {
      list = list.filter((i) => filterState.audience.has(i.audience));
    }
    if (q) {
      list = list.filter((i) => {
        const hay = (
          i.title +
          " " +
          i.description +
          " " +
          i.labels.join(" ")
        ).toLowerCase();
        return hay.includes(q);
      });
    }

    const sort = filterState.sort;
    list.sort((a, b) => {
      if (sort === "updated-desc") return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === "created-desc") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "priority-asc") {
        const pa = PRIORITY_ORDER[a.priority] ?? 9;
        const pb = PRIORITY_ORDER[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      if (sort === "tokens-desc") {
        if (b.estimatedTokens !== a.estimatedTokens) return b.estimatedTokens - a.estimatedTokens;
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return 0;
    });
    return list;
  }

  function labelForStatus(id) {
    return STATUSES.find((s) => s.id === id)?.label ?? id;
  }

  function badgeClass(prefix, id) {
    return "badge badge--" + prefix + "-" + id;
  }

  function formatShortDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function renderBudgetAndStats() {
    const cap = Math.max(0, Number(els.budgetCap.value) || 0);
    localStorage.setItem(STORAGE_BUDGET, String(cap));

    const openIssues = issues.filter((i) => i.status !== "done");
    const estimatedSum = openIssues.reduce((s, i) => s + (i.estimatedTokens || 0), 0);

    els.statEstimated.textContent = estimatedSum.toLocaleString();
    els.statOpen.textContent = String(openIssues.length);

    let pct = 0;
    if (cap > 0) pct = Math.min(100, Math.round((estimatedSum / cap) * 100));
    els.budgetMeterFill.style.width = pct + "%";
    els.budgetMeter.setAttribute("aria-valuenow", String(pct));
    const labelText = pct + "% of cap (" + estimatedSum.toLocaleString() + " / " + cap.toLocaleString() + ")";
    els.budgetMeterLabel.textContent = labelText;
    els.budgetMeter.setAttribute("aria-valuetext", labelText);

    els.budgetMeterFill.classList.toggle("is-warn", pct >= 85);
  }

  function renderList() {
    const list = getFilteredSorted();
    els.issueList.innerHTML = "";

    els.resultsCount.textContent =
      list.length === 1 ? "1 issue" : list.length + " issues";

    if (!list.length) {
      els.emptyState.hidden = false;
      els.issueList.hidden = true;
      renderBudgetAndStats();
      return;
    }

    els.emptyState.hidden = true;
    els.issueList.hidden = false;

    list.forEach((issue) => {
      const li = document.createElement("li");
      li.className = "issue-card";

      const top = document.createElement("div");
      top.className = "issue-card__top";

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "issue-card__title-btn issue-card__title";
      titleBtn.textContent = issue.title || "(Untitled)";
      titleBtn.addEventListener("click", () => openModal(issue.id));

      const meta = document.createElement("div");
      meta.className = "issue-card__meta";

      const st = document.createElement("span");
      st.className = badgeClass("status", issue.status);
      st.textContent = labelForStatus(issue.status);

      const pr = document.createElement("span");
      pr.className = "badge badge--" + issue.priority;

      const prLabel = PRIORITIES.find((p) => p.id === issue.priority)?.label ?? issue.priority;
      pr.textContent = prLabel.split(" — ")[0];

      const aud = document.createElement("span");
      aud.className = "badge badge--" + issue.audience;
      aud.textContent =
        issue.audience === "both" ? "Human + agent" : AUDIENCES.find((a) => a.id === issue.audience)?.label ?? issue.audience;

      meta.append(st, pr, aud);
      top.append(titleBtn, meta);

      const desc = document.createElement("p");
      desc.className = "issue-card__desc";
      desc.textContent = issue.description || "No description.";

      const foot = document.createElement("div");
      foot.className = "issue-card__footer";
      const tok =
        issue.estimatedTokens > 0
          ? "Est. " + issue.estimatedTokens.toLocaleString() + " tok"
          : "No token estimate";
      const tim =
        issue.timeBudgetMin > 0 ? " · " + issue.timeBudgetMin + " min budget" : "";
      const updated = " · Updated " + formatShortDate(issue.updatedAt);
      foot.appendChild(document.createTextNode(tok + tim + updated));

      if (issue.labels.length) {
        const tags = document.createElement("div");
        tags.className = "issue-card__labels";
        issue.labels.forEach((lb) => {
          const span = document.createElement("span");
          span.className = "tag";
          span.textContent = lb;
          tags.appendChild(span);
        });
        foot.appendChild(tags);
      }

      li.append(top, desc, foot);
      els.issueList.appendChild(li);
    });

    renderBudgetAndStats();
  }

  function render() {
    syncChipUI();
    renderList();
  }

  let density = localStorage.getItem(STORAGE_DENSITY) || "comfortable";

  function applyDensity() {
    const compact = density === "compact";
    els.issueList.classList.toggle("issue-list--compact", compact);
    document.querySelectorAll(".segmented__btn").forEach((b) => {
      const btn = /** @type {HTMLButtonElement} */ (b);
      const isThis = btn.dataset.density === density;
      btn.classList.toggle("is-active", isThis);
      btn.setAttribute("aria-pressed", isThis ? "true" : "false");
    });
    localStorage.setItem(STORAGE_DENSITY, density);
  }

  function openModal(issueId) {
    const isNew = !issueId;
    /** @type {Issue | null} */
    const issue = isNew ? null : issues.find((i) => i.id === issueId) || null;

    els.modalTitle.textContent = isNew ? "New issue" : "Edit issue";
    els.issueId.value = issue ? issue.id : "";
    els.issueTitle.value = issue ? issue.title : "";
    els.issueDescription.value = issue ? issue.description : "";
    els.issueStatus.value = issue ? issue.status : "backlog";
    els.issuePriority.value = issue ? issue.priority : "p2";
    els.issueAudience.value = issue ? issue.audience : "both";
    els.issueTokens.value = issue ? String(issue.estimatedTokens) : "0";
    els.issueTime.value = issue ? String(issue.timeBudgetMin) : "0";
    els.issueLabels.value = issue ? issue.labels.join(", ") : "";
    els.btnDeleteIssue.hidden = isNew;

    els.modalBackdrop.hidden = false;
    els.issueTitle.focus();
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    els.issueForm.reset();
  }

  function deleteCurrentIssue() {
    const id = els.issueId.value;
    if (!id) return;
    if (!confirm("Delete this issue? This cannot be undone.")) return;
    issues = issues.filter((i) => i.id !== id);
    saveIssues(issues);
    closeModal();
    render();
    toast("Issue deleted.");
  }

  function onSubmitForm(e) {
    e.preventDefault();
    const id = els.issueId.value || uid();
    const isNew = !els.issueId.value;
    const title = els.issueTitle.value.trim();
    if (!title) {
      els.issueTitle.focus();
      return;
    }
    const description = els.issueDescription.value.trim();
    const status = els.issueStatus.value;
    const priority = els.issuePriority.value;
    const audience = els.issueAudience.value;
    const estimatedTokens = Math.max(0, Number(els.issueTokens.value) || 0);
    const timeBudgetMin = Math.max(0, Number(els.issueTime.value) || 0);
    const labels = els.issueLabels.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const existing = issues.find((i) => i.id === id);
    const createdAt = existing ? existing.createdAt : nowIso();
    const updatedAt = nowIso();

    /** @type {Issue} */
    const rec = {
      id,
      title,
      description,
      status,
      priority,
      audience,
      estimatedTokens,
      timeBudgetMin,
      labels,
      createdAt,
      updatedAt,
    };

    if (isNew) issues.unshift(rec);
    else {
      const idx = issues.findIndex((i) => i.id === id);
      if (idx >= 0) issues[idx] = rec;
      else issues.unshift(rec);
    }
    saveIssues(issues);
    closeModal();
    render();
    toast(isNew ? "Issue created." : "Issue saved.");
  }

  function seedDemoIfEmpty() {
    if (issues.length) return;
    const t = nowIso();
    issues = [
      normalizeIssue({
        id: uid(),
        title: "Define agent-readable issue schema",
        description:
          "JSON shape for export/import: id, title, status, priority, audience, estimates, labels, timestamps.",
        status: "in_progress",
        priority: "p1",
        audience: "both",
        estimatedTokens: 12000,
        timeBudgetMin: 45,
        labels: ["schema", "agents"],
        createdAt: t,
        updatedAt: t,
      }),
      normalizeIssue({
        id: uid(),
        title: "Wire CI badge into README",
        description: "Human task: align with course repo conventions.",
        status: "backlog",
        priority: "p3",
        audience: "human",
        estimatedTokens: 2000,
        timeBudgetMin: 20,
        labels: ["docs"],
        createdAt: t,
        updatedAt: t,
      }),
    ].filter(Boolean);
    saveIssues(issues);
  }

  function init() {
    seedDemoIfEmpty();

    fillSelect(els.issueStatus, STATUSES);
    fillSelect(els.issuePriority, PRIORITIES);
    fillSelect(els.issueAudience, AUDIENCES);

    buildFilterChips(els.filterStatus, STATUSES, "status");
    buildFilterChips(els.filterPriority, PRIORITIES, "priority");
    buildFilterChips(els.filterAudience, AUDIENCES, "audience");

    const savedCap = localStorage.getItem(STORAGE_BUDGET);
    if (savedCap !== null) els.budgetCap.value = savedCap;

    els.filterSearch.addEventListener("input", () => {
      filterState.search = els.filterSearch.value;
      render();
    });
    els.filterSort.addEventListener("change", () => {
      filterState.sort = els.filterSort.value;
      render();
    });
    els.budgetCap.addEventListener("input", () => renderBudgetAndStats());

    els.btnClearFilters.addEventListener("click", () => {
      filterState.search = "";
      filterState.status.clear();
      filterState.priority.clear();
      filterState.audience.clear();
      els.filterSearch.value = "";
      els.filterSort.value = "updated-desc";
      filterState.sort = "updated-desc";
      render();
    });

    els.btnNewIssue.addEventListener("click", () => openModal(null));
    els.modalClose.addEventListener("click", closeModal);
    els.btnCancel.addEventListener("click", closeModal);
    els.btnDeleteIssue.addEventListener("click", deleteCurrentIssue);
    els.issueForm.addEventListener("submit", onSubmitForm);

    els.modalBackdrop.addEventListener("click", (e) => {
      if (e.target === els.modalBackdrop) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modalBackdrop.hidden) {
        closeModal();
      }
    });

    els.btnExport.addEventListener("click", openIssuesExport);
    els.btnImportTrigger.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", () => {
      const f = els.importFile.files && els.importFile.files[0];
      if (f) importIssuesFromFile(f);
      els.importFile.value = "";
    });

    document.querySelectorAll(".segmented__btn").forEach((b) => {
      b.addEventListener("click", () => {
        const d = b.getAttribute("data-density");
        if (d === "comfortable" || d === "compact") {
          density = d;
          applyDensity();
        }
      });
    });

    applyDensity();

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
