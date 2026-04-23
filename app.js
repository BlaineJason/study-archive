const STORAGE_KEY = "study-archive-records-v2";
const TAXONOMY_KEY = "study-archive-taxonomy-v2";

const entryForm = document.getElementById("entryForm");
const template = document.getElementById("entryTemplate");
const activeList = document.getElementById("activeList");
const archiveList = document.getElementById("archiveList");
const archivePanel = document.querySelector(".archive-panel");
const archiveTopicIndex = document.getElementById("archiveTopicIndex");
const knowledgeGraph = document.getElementById("knowledgeGraph");
const exportBtn = document.getElementById("exportBtn");
const clearActiveBtn = document.getElementById("clearActiveBtn");
const importInput = document.getElementById("importInput");
const searchInput = document.getElementById("searchInput");
const topicFilter = document.getElementById("topicFilter");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const scopeFilter = document.getElementById("scopeFilter");
const resetFilters = document.getElementById("resetFilters");
const editingRecordIdInput = document.getElementById("editingRecordId");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const fileReaderInput = document.getElementById("fileReaderInput");
const fileImportResults = document.getElementById("fileImportResults");
const splitModeInput = document.getElementById("splitMode");
const tagSelect = document.getElementById("tagSelect");
const customTopicWrap = document.getElementById("customTopicWrap");
const customTypeWrap = document.getElementById("customTypeWrap");
const customTagWrap = document.getElementById("customTagWrap");
const customTopicInput = document.getElementById("customTopicInput");
const customTypeInput = document.getElementById("customTypeInput");
const customTagInput = document.getElementById("customTagInput");
const addCustomTopicBtn = document.getElementById("addCustomTopicBtn");
const addCustomTypeBtn = document.getElementById("addCustomTypeBtn");
const addCustomTagBtn = document.getElementById("addCustomTagBtn");

const fields = {
  title: document.getElementById("title"),
  topic: document.getElementById("topic"),
  type: document.getElementById("type"),
  status: document.getElementById("status"),
  studyDate: document.getElementById("studyDate"),
  tags: document.getElementById("tags"),
  content: document.getElementById("content"),
  archiveRule: document.getElementById("archiveRule"),
  nextAction: document.getElementById("nextAction"),
};

const stats = {
  activeCount: document.getElementById("activeCount"),
  archiveCount: document.getElementById("archiveCount"),
  topTopic: document.getElementById("topTopic"),
  todayCount: document.getElementById("todayCount"),
  reviewCount: document.getElementById("reviewCount"),
  topicCount: document.getElementById("topicCount"),
  smartSummary: document.getElementById("smartSummary"),
  topicHeatmap: document.getElementById("topicHeatmap"),
};

const filterState = {
  search: "",
  topic: "all",
  type: "all",
  status: "all",
  scope: "all",
};

const taxonomy = loadTaxonomy();
let records = loadRecords();
let currentArchivedView = [];

fields.studyDate.value = today();
applyAutoArchive();
rebuildTaxonomyFromRecords();
syncFilterOptions();
syncEntryControls();
render();
resetFormState();

archiveTopicIndex.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#archive-']");
  if (!link) return;
  event.preventDefault();
  openArchiveHash(link.getAttribute("href"));
});

window.addEventListener("hashchange", () => {
  renderArchive(currentArchivedView);
  scrollToArchiveTarget();
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const now = new Date().toISOString();
  const editingId = editingRecordIdInput.value.trim();
  const existing = editingId ? records.find((record) => record.id === editingId) : null;
  const topicValue = fields.topic.value === "__custom__" ? customTopicInput.value.trim() : fields.topic.value.trim();
  const typeValue = fields.type.value === "__custom__" ? customTypeInput.value.trim() : fields.type.value.trim();
  const tagList = parseTags(fields.tags.value);

  if (!topicValue || !typeValue) {
    window.alert("请先选择或添加学习主题和学习类型。");
    return;
  }

  const record = {
    id: existing?.id || crypto.randomUUID(),
    title: fields.title.value.trim(),
    topic: topicValue,
    type: typeValue,
    status: fields.status.value,
    studyDate: fields.studyDate.value,
    tags: tagList,
    content: fields.content.value.trim(),
    archiveRule: fields.archiveRule.value,
    nextAction: fields.nextAction.value.trim(),
    updatedAt: now,
    archivedAt: existing?.archivedAt || null,
  };

  if (existing) {
    records = records.map((item) => (item.id === existing.id ? record : item));
  } else {
    records.unshift(record);
  }

  absorbTaxonomyFromRecord(record);
  persist();
  applyAutoArchive();
  syncFilterOptions();
  syncEntryControls();
  render();
  resetFormState();
});

cancelEditBtn.addEventListener("click", resetFormState);

fields.topic.addEventListener("change", () => {
  toggleCustomInput(fields.topic, customTopicWrap, customTopicInput);
});

fields.type.addEventListener("change", () => {
  toggleCustomInput(fields.type, customTypeWrap, customTypeInput);
});

tagSelect.addEventListener("change", () => {
  if (tagSelect.value === "__custom__") {
    customTagWrap.hidden = false;
    customTagInput.focus();
    return;
  }

  customTagWrap.hidden = true;
  customTagInput.value = "";
  if (tagSelect.value) {
    fields.tags.value = mergeTagInput(fields.tags.value, tagSelect.value);
  }
  tagSelect.value = "";
});

addCustomTopicBtn.addEventListener("click", () => {
  const value = customTopicInput.value.trim();
  if (!value) return;
  addTaxonomyValue("topics", value);
  fields.topic.value = value;
  customTopicWrap.hidden = true;
  customTopicInput.value = "";
});

addCustomTypeBtn.addEventListener("click", () => {
  const value = customTypeInput.value.trim();
  if (!value) return;
  addTaxonomyValue("types", value);
  fields.type.value = value;
  customTypeWrap.hidden = true;
  customTypeInput.value = "";
});

addCustomTagBtn.addEventListener("click", () => {
  const value = customTagInput.value.trim();
  if (!value) return;
  addTaxonomyValue("tags", value);
  fields.tags.value = mergeTagInput(fields.tags.value, value);
  customTagWrap.hidden = true;
  customTagInput.value = "";
  tagSelect.value = "";
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `study-archive-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

clearActiveBtn.addEventListener("click", () => {
  const activeCount = records.filter((record) => !record.archivedAt).length;
  if (!activeCount) {
    window.alert("当前没有未归档的学习记录。");
    return;
  }

  if (!window.confirm(`将删除 ${activeCount} 条未归档记录，已归档内容会保留。是否继续？`)) return;

  records = records.filter((record) => record.archivedAt);
  rebuildTaxonomyFromRecords();
  persist();
  syncFilterOptions();
  syncEntryControls();
  render();
  resetFormState();
});

importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("JSON 文件必须是数组。");
    records = imported;
    rebuildTaxonomyFromRecords();
    persist();
    applyAutoArchive();
    syncFilterOptions();
    syncEntryControls();
    render();
  } catch (error) {
    window.alert(`导入失败：${error.message}`);
  } finally {
    importInput.value = "";
  }
});

searchInput.addEventListener("input", (event) => {
  filterState.search = event.target.value.trim().toLowerCase();
  render();
});

topicFilter.addEventListener("change", (event) => {
  filterState.topic = event.target.value;
  render();
});

typeFilter.addEventListener("change", (event) => {
  filterState.type = event.target.value;
  render();
});

statusFilter.addEventListener("change", (event) => {
  filterState.status = event.target.value;
  render();
});

scopeFilter.addEventListener("change", (event) => {
  filterState.scope = event.target.value;
  render();
});

resetFilters.addEventListener("click", () => {
  filterState.search = "";
  filterState.topic = "all";
  filterState.type = "all";
  filterState.status = "all";
  filterState.scope = "all";
  searchInput.value = "";
  topicFilter.value = "all";
  typeFilter.value = "all";
  statusFilter.value = "all";
  scopeFilter.value = "all";
  render();
});

fileReaderInput.addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;

  const results = [];
  for (const file of files) {
    try {
      const text = await readFileContent(file);
      const imported = buildRecordsFromFile(file, text, splitModeInput.value);
      records.unshift(...imported.records.reverse());
      imported.records.forEach(absorbTaxonomyFromRecord);
      results.push(imported.summary);
    } catch (error) {
      results.push({ fileName: file.name, ok: false, message: `读取失败：${error.message}` });
    }
  }

  persist();
  applyAutoArchive();
  syncFilterOptions();
  syncEntryControls();
  render();
  renderFileImportResults(results);
  fileReaderInput.value = "";
});

async function readFileContent(file) {
  const extension = getExtension(file.name);
  if (extension === "pdf") return readPdfFile(file);
  if (extension === "docx") return readDocxFile(file);
  return file.text();
}

async function readDocxFile(file) {
  if (!window.mammoth) throw new Error("Word 解析器尚未加载完成。");
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value?.trim() || "";
}

async function readPdfFile(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }

  return pages.join("\n").trim();
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  window.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

function loadRecords() {
  const bootstrap = loadBootstrapRecords();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return bootstrap.length ? bootstrap : seedData();

  try {
    const parsed = JSON.parse(raw);
    return mergeRecords(bootstrap, Array.isArray(parsed) ? parsed : seedData());
  } catch {
    return bootstrap.length ? bootstrap : seedData();
  }
}

function loadBootstrapRecords() {
  const bootstrap = window.__STUDY_ARCHIVE_BOOTSTRAP__;
  return Array.isArray(bootstrap) ? bootstrap : [];
}

function mergeRecords(primaryRecords = [], secondaryRecords = []) {
  const merged = new Map();

  function recordMoment(record) {
    return new Date(record?.archivedAt || record?.updatedAt || record?.studyDate || 0).getTime() || 0;
  }

  function preferRecord(current, incoming) {
    if (!current) return incoming;
    const currentTs = recordMoment(current);
    const incomingTs = recordMoment(incoming);
    if (incomingTs > currentTs) return incoming;
    if (incomingTs < currentTs) return current;

    if (incoming?.archivedAt && !current?.archivedAt) return incoming;
    if (!incoming?.archivedAt && current?.archivedAt) return current;
    return { ...current, ...incoming };
  }

  [...primaryRecords, ...secondaryRecords].forEach((record) => {
    if (!record || !record.id) return;
    merged.set(record.id, preferRecord(merged.get(record.id), record));
  });

  return [...merged.values()].sort(sortByRecent);
}

function loadTaxonomy() {
  const defaults = {
    topics: ["投资", "AI", "生活"],
    types: ["课程", "阅读", "练习", "项目", "复盘"],
    tags: ["投资", "AI", "生活", "复盘"],
  };

  const raw = localStorage.getItem(TAXONOMY_KEY);
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return {
      topics: uniqueArray([...(parsed.topics || []), ...defaults.topics]),
      types: uniqueArray([...(parsed.types || []), ...defaults.types]),
      tags: uniqueArray([...(parsed.tags || []), ...defaults.tags]),
    };
  } catch {
    return defaults;
  }
}

function seedData() {
  const now = new Date();
  return [
    {
      id: crypto.randomUUID(),
      title: "AI 工具工作流拆解",
      topic: "AI",
      type: "项目",
      status: "学习中",
      studyDate: now.toISOString().slice(0, 10),
      tags: ["AI", "工具流"],
      content: "整理了常用 AI 工具在学习和记录场景中的配合方式，准备继续优化个人工作流。",
      archiveRule: "14",
      nextAction: "补一版适合自己的 AI 使用清单",
      updatedAt: now.toISOString(),
      archivedAt: null,
    },
    {
      id: crypto.randomUUID(),
      title: "每周生活复盘模板",
      topic: "生活",
      type: "复盘",
      status: "待复习",
      studyDate: new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
      tags: ["生活", "复盘"],
      content: "总结记录作息、运动、消费和情绪变化的复盘结构，准备继续细化。",
      archiveRule: "auto",
      nextAction: "明天补充一版适合日常执行的复盘模板",
      updatedAt: new Date(now.getTime() - 86400000).toISOString(),
      archivedAt: null,
    },
  ];
}

function persist() {
  records = mergeRecords(loadBootstrapRecords(), records);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  persistTaxonomy();
}

function persistTaxonomy() {
  localStorage.setItem(TAXONOMY_KEY, JSON.stringify(taxonomy));
}

function addTaxonomyValue(kind, value) {
  taxonomy[kind] = uniqueArray([...taxonomy[kind], value]);
  persistTaxonomy();
  syncEntryControls();
}

function absorbTaxonomyFromRecord(record) {
  taxonomy.topics = uniqueArray([...taxonomy.topics, record.topic]);
  taxonomy.types = uniqueArray([...taxonomy.types, record.type]);
  taxonomy.tags = uniqueArray([...taxonomy.tags, ...(record.tags || [])]);
  persistTaxonomy();
}

function rebuildTaxonomyFromRecords() {
  const defaults = loadTaxonomy();
  taxonomy.topics = uniqueArray([...defaults.topics, ...records.map((record) => record.topic)]);
  taxonomy.types = uniqueArray([...defaults.types, ...records.map((record) => record.type)]);
  taxonomy.tags = uniqueArray([...defaults.tags, ...records.flatMap((record) => record.tags || [])]);
  persistTaxonomy();
}

function applyAutoArchive() {
  const nowTs = Date.now();
  records = records.map((record) => {
    if (record.archivedAt) return record;
    const updated = new Date(record.updatedAt || record.studyDate).getTime();
    const idleDays = Math.floor((nowTs - updated) / 86400000);
    const shouldArchive =
      (record.archiveRule === "auto" && record.status === "已掌握" && idleDays >= 3) ||
      (["7", "14", "30"].includes(record.archiveRule) && idleDays >= Number(record.archiveRule));
    return shouldArchive ? { ...record, archivedAt: new Date().toISOString() } : record;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function render() {
  const active = records.filter((record) => !record.archivedAt).sort(sortByRecent);
  const archived = records.filter((record) => record.archivedAt).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  const filteredActive = active.filter((record) => matchesFilters(record, false));
  const filteredArchived = archived.filter((record) => matchesFilters(record, true));

  renderActive(filteredActive);
  renderArchive(filteredArchived);
  renderStats(filteredActive, filteredArchived);
  renderKnowledge(filteredArchived);
}

function renderActive(active) {
  activeList.innerHTML = "";
  if (!active.length) {
    activeList.innerHTML = `<div class="empty-state">没有符合当前搜索或筛选条件的活跃记录。</div>`;
    return;
  }
  active.forEach((record) => activeList.appendChild(buildCard(record, false)));
}

function renderArchive(archived) {
  currentArchivedView = archived;
  archiveList.innerHTML = "";
  if (!archived.length) {
    archivePanel.hidden = true;
    archiveList.innerHTML = `<div class="empty-state">没有符合当前搜索或筛选条件的归档记录。</div>`;
    return;
  }

  const topicGroups = buildArchiveTopicGroups(archived);
  const selection = resolveArchiveSelection(topicGroups, currentArchiveHash());

  archivePanel.hidden = false;

  if (selection) {
    archiveList.appendChild(buildArchiveTopicSection(selection.group, selection.recordId));
    return;
  }

  topicGroups.forEach((group) => {
    archiveList.appendChild(buildArchiveTopicSection(group));
  });
}

function renderKnowledge(archived) {
  renderKnowledgeIndex(archived);
  renderKnowledgeGraph(archived);
}

function buildArchiveTopicSection(group, highlightedRecordId = "") {
  const wrapper = document.createElement("section");
  wrapper.className = "archive-group archive-topic-section";
  wrapper.id = group.topicId;
  wrapper.innerHTML = `<h3>${escapeHtml(group.topic)}</h3><div class="archive-stack"></div>`;
  const stack = wrapper.querySelector(".archive-stack");

  group.months.forEach((monthGroup) => {
    const monthBlock = document.createElement("section");
    monthBlock.className = "archive-month-group";
    monthBlock.innerHTML = `<h4 class="archive-month-title">${escapeHtml(monthGroup.month)}</h4><div class="archive-stack"></div>`;
    const monthStack = monthBlock.querySelector(".archive-stack");
    monthGroup.records.forEach((record) => {
      const card = buildCard(record, true);
      card.id = archiveRecordAnchorId(record.id);
      card.classList.add("archive-record-anchor");
      if (record.id === highlightedRecordId) {
        card.classList.add("archive-record-focus");
      }
      monthStack.appendChild(card);
    });
    stack.appendChild(monthBlock);
  });

  return wrapper;
}

function resolveArchiveSelection(topicGroups, hash) {
  if (!hash) return null;

  const topicMatch = topicGroups.find((group) => group.topicId === hash);
  if (topicMatch) {
    return { group: topicMatch, recordId: "" };
  }

  const recordId = hash.startsWith("archive-record-") ? hash.replace("archive-record-", "") : "";
  if (!recordId) return null;

  const recordGroup = topicGroups.find((group) => group.records.some((record) => record.id === recordId));
  return recordGroup ? { group: recordGroup, recordId } : null;
}

function renderKnowledgeIndex(archived) {
  archiveTopicIndex.innerHTML = "";
  if (!archived.length) {
    archiveTopicIndex.innerHTML = `<div class="empty-state">当前还没有可建立索引的归档知识。</div>`;
    return;
  }

  buildArchiveTopicGroups(archived).forEach((group) => {
    const card = document.createElement("article");
    card.className = "directory-group";
    card.innerHTML = `
      <h3><a class="directory-topic-link" href="#${escapeHtml(group.topicId)}">${escapeHtml(group.topic)}</a></h3>
      <p class="directory-meta">${group.count} 条归档记录 · 最近更新 ${escapeHtml(group.latestDate)}</p>
      <ul class="directory-records">
        ${group.records.map((record) => `<li><a class="directory-record-link" href="#${escapeHtml(archiveRecordAnchorId(record.id))}">${escapeHtml(record.title)}</a></li>`).join("")}
      </ul>
    `;
    archiveTopicIndex.appendChild(card);
  });
}

function renderKnowledgeGraph(archived) {
  knowledgeGraph.innerHTML = "";
  if (!archived.length) {
    knowledgeGraph.innerHTML = `<div class="empty-state">归档后，这里会自动生成主题知识图谱。</div>`;
    return;
  }

  const graph = buildKnowledgeGraphData(archived);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("graph-canvas");

  graph.edges.forEach((edge) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", edge.from.x);
    line.setAttribute("y1", edge.from.y);
    line.setAttribute("x2", edge.to.x);
    line.setAttribute("y2", edge.to.y);
    line.setAttribute("class", "graph-line");
    svg.appendChild(line);
  });

  knowledgeGraph.appendChild(svg);
  graph.nodes.forEach((node) => {
    const item = document.createElement("div");
    item.className = `graph-node ${node.className}`;
    item.style.left = `${node.x}%`;
    item.style.top = `${node.y}%`;
    item.innerHTML = `<strong>${escapeHtml(node.label)}</strong><span>${escapeHtml(node.meta)}</span>`;
    knowledgeGraph.appendChild(item);
  });
}

function buildCard(record, archived) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".record-title").textContent = record.title;
  node.querySelector(".record-meta").textContent = `${record.topic} · ${record.type} · ${record.studyDate}`;
  node.querySelector(".record-content").textContent = record.content;
  node.querySelector(".record-action").textContent = record.nextAction ? `下次行动：${record.nextAction}` : "下次行动：暂未填写";

  const status = node.querySelector(".record-status");
  status.textContent = archived ? "已归档" : record.status;
  status.className = `record-status ${statusClass(archived ? "已归档" : record.status)}`;

  const tags = node.querySelector(".record-tags");
  (record.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = `#${tag}`;
    tags.appendChild(chip);
  });

  node.querySelector(".edit-action").addEventListener("click", () => startEditing(record));
  const archiveAction = node.querySelector(".archive-action");
  const restoreAction = node.querySelector(".restore-action");
  archiveAction.hidden = archived;
  restoreAction.hidden = !archived;
  archiveAction.addEventListener("click", () => updateRecord(record.id, { archivedAt: new Date().toISOString() }));
  restoreAction.addEventListener("click", () => updateRecord(record.id, { archivedAt: null, updatedAt: new Date().toISOString() }));
  node.querySelector(".delete-action").addEventListener("click", () => deleteRecord(record.id));
  return node;
}

function startEditing(record) {
  editingRecordIdInput.value = record.id;
  fields.title.value = record.title;
  fields.topic.value = record.topic;
  fields.type.value = record.type;
  fields.status.value = record.status;
  fields.studyDate.value = record.studyDate;
  fields.tags.value = (record.tags || []).join(", ");
  fields.content.value = record.content;
  fields.archiveRule.value = record.archiveRule || "14";
  fields.nextAction.value = record.nextAction || "";
  resetCustomInputs();
  submitBtn.textContent = "保存修改";
  cancelEditBtn.hidden = false;
  entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetFormState() {
  entryForm.reset();
  editingRecordIdInput.value = "";
  fields.studyDate.value = today();
  syncEntryControls();
  fields.topic.value = taxonomy.topics[0] || "";
  fields.type.value = taxonomy.types[0] || "";
  tagSelect.value = "";
  resetCustomInputs();
  submitBtn.textContent = "保存并整理";
  cancelEditBtn.hidden = true;
}

function resetCustomInputs() {
  customTopicWrap.hidden = true;
  customTypeWrap.hidden = true;
  customTagWrap.hidden = true;
  customTopicInput.value = "";
  customTypeInput.value = "";
  customTagInput.value = "";
}

function updateRecord(id, patch) {
  records = records.map((record) => (record.id === id ? { ...record, ...patch } : record));
  const updated = records.find((record) => record.id === id);
  if (updated) absorbTaxonomyFromRecord(updated);
  persist();
  syncFilterOptions();
  syncEntryControls();
  render();
}

function deleteRecord(id) {
  records = records.filter((record) => record.id !== id);
  rebuildTaxonomyFromRecords();
  persist();
  syncFilterOptions();
  syncEntryControls();
  render();
  if (editingRecordIdInput.value === id) resetFormState();
}

function matchesFilters(record, archived) {
  if (filterState.scope === "active" && archived) return false;
  if (filterState.scope === "archived" && !archived) return false;
  if (filterState.topic !== "all" && record.topic !== filterState.topic) return false;
  if (filterState.type !== "all" && record.type !== filterState.type) return false;
  if (filterState.status !== "all" && record.status !== filterState.status) return false;

  if (filterState.search) {
    const searchable = [
      record.title,
      record.topic,
      record.type,
      record.status,
      record.content,
      record.nextAction,
      ...(record.tags || []),
    ].join(" ").toLowerCase();
    if (!searchable.includes(filterState.search)) return false;
  }

  return true;
}

function renderStats(active, archived) {
  const visibleRecords = [...active, ...archived];
  const topicCounter = countBy(active, "topic");
  const hottestTopic = Object.entries(topicCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "暂无";

  stats.activeCount.textContent = String(active.length);
  stats.archiveCount.textContent = String(archived.length);
  stats.topTopic.textContent = hottestTopic;
  stats.todayCount.textContent = String(visibleRecords.filter((record) => record.studyDate === today()).length);
  stats.reviewCount.textContent = String(active.filter((record) => record.status === "待复习").length);
  stats.topicCount.textContent = String(new Set(visibleRecords.map((record) => record.topic)).size);

  stats.smartSummary.innerHTML = buildSuggestions(active, archived, topicCounter).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  stats.topicHeatmap.innerHTML = "";
  const sortedTopics = Object.entries(topicCounter).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sortedTopics.length) {
    stats.topicHeatmap.innerHTML = `<div class="empty-state">当前筛选结果还没有主题热度数据。</div>`;
    return;
  }

  sortedTopics.forEach(([topic, count]) => {
    const chip = document.createElement("span");
    chip.className = "heat-chip";
    chip.textContent = `${topic} · ${count}`;
    stats.topicHeatmap.appendChild(chip);
  });
}

function buildSuggestions(active, archived, topicCounter) {
  if (!active.length && !archived.length) return ["当前没有符合筛选条件的学习记录。"];

  const suggestions = [];
  const reviewItems = active.filter((record) => record.status === "待复习").length;
  if (reviewItems) suggestions.push(`当前有 ${reviewItems} 条待复习记录，可以优先安排回顾。`);

  const hottestTopic = Object.entries(topicCounter).sort((a, b) => b[1] - a[1])[0];
  if (hottestTopic) suggestions.push(`当前最集中的主题是“${hottestTopic[0]}”，共有 ${hottestTopic[1]} 条活跃记录。`);

  if (archived.length) suggestions.push(`当前筛选结果中已有 ${archived.length} 条内容沉淀进归档区。`);

  const noAction = active.filter((record) => !record.nextAction).length;
  if (noAction) suggestions.push(`还有 ${noAction} 条记录没有写下次行动，可以继续补充。`);

  return suggestions.slice(0, 4);
}

function buildArchiveTopicGroups(archived) {
  return Object.entries(
    archived.reduce((acc, record) => {
      const topic = record.topic || "未分类";
      acc[topic] ??= [];
      acc[topic].push(record);
      return acc;
    }, {})
  )
    .map(([topic, items]) => ({
      topic,
      topicId: archiveTopicAnchorId(topic),
      count: items.length,
      latestDate: items
        .map((item) => item.archivedAt || item.updatedAt || item.studyDate)
        .sort((a, b) => new Date(b) - new Date(a))[0]
        ?.slice(0, 10) || "--",
      records: items.slice().sort(sortByArchived),
      months: buildArchiveMonthGroups(items),
      titles: items.slice().sort(sortByArchived).slice(0, 3).map((item) => item.title),
      types: uniqueArray(items.map((item) => item.type)).slice(0, 4),
      tags: uniqueArray(items.flatMap((item) => item.tags || [])).slice(0, 6),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildArchiveMonthGroups(items) {
  const grouped = items.reduce((acc, record) => {
    const key = (record.studyDate || today()).slice(0, 7);
    acc[key] ??= [];
    acc[key].push(record);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0], "zh-CN"))
    .map(([month, monthRecords]) => ({
      month,
      records: monthRecords.slice().sort(sortByArchived),
    }));
}

function buildKnowledgeGraphData(archived) {
  const keywordStats = buildKeywordStats(archived).slice(0, 10);
  const nodes = [
    { label: "关键词", meta: `${archived.length} 条归档`, x: 50, y: 50, className: "graph-node-center" },
  ];
  const edges = [];

  keywordStats.forEach((keyword, index) => {
    const angle = (-90 + (360 / keywordStats.length) * index) * (Math.PI / 180);
    const keywordPoint = polarToPoint(50, 50, 30, angle);
    nodes.push({
      label: keyword.label,
      meta: `出现 ${keyword.count} 次`,
      x: keywordPoint.x,
      y: keywordPoint.y,
      className: "graph-node-topic",
    });
    edges.push({ from: { x: 50, y: 50 }, to: keywordPoint });
  });

  return { nodes, edges };
}

function buildKeywordStats(archived) {
  const keywordMap = new Map();

  archived.forEach((record) => {
    const keywords = extractKeywords(record);
    keywords.forEach((keyword) => {
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, {
          label: keyword,
          count: 0,
        });
      }

      const entry = keywordMap.get(keyword);
      entry.count += 1;
    });
  });

  return [...keywordMap.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function extractKeywords(record) {
  const fromTags = (record.tags || []).map((tag) => tag.trim()).filter(Boolean);
  const text = `${record.title} ${record.content}`.toLowerCase();
  const candidates = [
    "投资",
    "基金",
    "股票",
    "债券",
    "财报",
    "估值",
    "ai",
    "agent",
    "prompt",
    "llm",
    "gpt",
    "模型",
    "自动化",
    "效率",
    "复盘",
    "习惯",
    "健康",
    "阅读",
    "项目",
    "课程",
  ];

  const inferred = candidates.filter((keyword) => text.includes(keyword.toLowerCase()));
  return uniqueArray([...fromTags, ...inferred]).slice(0, 8);
}

function syncFilterOptions() {
  syncSelectOptions(topicFilter, uniqueValues(records, "topic"), "全部主题", "topic");
  syncSelectOptions(typeFilter, uniqueValues(records, "type"), "全部类型", "type");
}

function syncEntryControls() {
  syncEntrySelect(fields.topic, taxonomy.topics, "选择学习主题");
  syncEntrySelect(fields.type, taxonomy.types, "选择学习类型");
  syncTagSelect();
}

function syncSelectOptions(select, values, allLabel, stateKey) {
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = allLabel;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (!values.includes(filterState[stateKey]) && filterState[stateKey] !== "all") {
    filterState[stateKey] = "all";
  }
  select.value = filterState[stateKey];
}

function syncEntrySelect(select, values, placeholder) {
  const currentValue = select.value && select.value !== "__custom__" ? select.value : "";
  select.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  select.appendChild(placeholderOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "+ 添加自定义...";
  select.appendChild(customOption);

  select.value = values.includes(currentValue) ? currentValue : values[0] || "";
}

function syncTagSelect() {
  const currentValue = tagSelect.value === "__custom__" ? "__custom__" : "";
  tagSelect.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "从下拉菜单添加标签";
  tagSelect.appendChild(placeholderOption);

  taxonomy.tags.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    tagSelect.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "+ 添加自定义标签...";
  tagSelect.appendChild(customOption);

  tagSelect.value = currentValue;
}

function toggleCustomInput(select, wrap, input) {
  const shouldShow = select.value === "__custom__";
  wrap.hidden = !shouldShow;
  if (shouldShow) {
    input.focus();
  } else {
    input.value = "";
  }
}

const IMPORT_CHUNK_TARGET = 1800;
const IMPORT_CHUNK_HARD_LIMIT = 2400;

function buildRecordsFromFile(file, text, splitMode = "topic") {
  const cleaned = text.replace(/\r/g, "").trim();
  const baseTitle = file.name.replace(/\.[^.]+$/, "") || "未命名导入记录";
  const extension = getExtension(file.name);
  const rawSections = splitIntoSections(cleaned, baseTitle, splitMode);
  const sections = rawSections.flatMap((section) => splitLargeSection(section, baseTitle));
  const now = new Date().toISOString();

  const builtRecords = sections.map((section, index) => {
    const title = section.title || `${baseTitle} · 片段 ${index + 1}`;
    const combined = `${title}\n${section.content}`;
    const type = inferType(extension, combined);
    return {
      id: crypto.randomUUID(),
      title,
      topic: inferTopic(combined),
      type,
      status: "学习中",
      studyDate: today(),
      tags: inferTags(combined, extension),
      content: section.content || "文件内容为空。",
      archiveRule: "14",
      nextAction: inferNextAction(section.content, type),
      updatedAt: now,
      archivedAt: null,
      sourceFile: file.name,
    };
  });

  const splitLabel = splitMode === "date" ? "日期" : "主题";
  const rawCount = rawSections.length;
  const finalCount = builtRecords.length;
  const message =
    rawCount === finalCount
      ? `已按${splitLabel}拆分为 ${finalCount} 条学习记录。`
      : `已按${splitLabel}拆分，并将超长内容继续分段，共生成 ${finalCount} 条完整学习记录（原始分段 ${rawCount} 条）。`;

  return {
    records: builtRecords,
    summary: {
      fileName: file.name,
      ok: true,
      message,
      tags: [...new Set(builtRecords.flatMap((record) => record.tags))].slice(0, 6),
    },
  };
}

function splitIntoSections(text, fallbackTitle, splitMode) {
  return splitMode === "date" ? splitByDate(text, fallbackTitle) : splitByTopic(text, fallbackTitle);
}

function splitByTopic(text, fallbackTitle) {
  const lines = text.split("\n").map((line) => line.trim());
  const sections = [];
  let currentTitle = "";
  let buffer = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (!content) return;
    sections.push({
      title: currentTitle || deriveTitleFromContent(content, fallbackTitle, sections.length),
      content,
    });
    buffer = [];
  };

  lines.forEach((line) => {
    if (!line) {
      buffer.push("");
      return;
    }

    if (isHeadingLine(line)) {
      flush();
      currentTitle = normalizeHeading(line);
      return;
    }

    buffer.push(line);
  });

  flush();

  if (!sections.length) {
    return text
      .split(/\n\s*\n+/)
      .map((block, index) => ({
        title: deriveTitleFromContent(block.trim(), fallbackTitle, index),
        content: block.trim(),
      }))
      .filter((section) => section.content);
  }

  return sections;
}

function splitByDate(text, fallbackTitle) {
  const matches = [...text.matchAll(/((?:19|20)\d{2}[-/.年](?:0?\d|1[0-2])[-/.月](?:0?\d|[12]\d|3[01])日?)/g)];
  if (!matches.length) {
    return [{ title: `${fallbackTitle} · ${today()}`, content: text.trim() }].filter((section) => section.content);
  }

  const sections = [];
  matches.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (!content) return;
    sections.push({
      title: `${fallbackTitle} · ${normalizeDateLabel(match[1])}`,
      content,
    });
  });
  return sections;
}

function splitLargeSection(section, fallbackTitle) {
  const content = (section?.content || "").trim();
  if (!content) return [];

  const title = section.title || deriveTitleFromContent(content, fallbackTitle, 0);
  if (content.length <= IMPORT_CHUNK_HARD_LIMIT) {
    return [{ title, content }];
  }

  const paragraphs = content.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  const blocks = paragraphs.length ? paragraphs : splitBySentenceBudget(content, IMPORT_CHUNK_TARGET);
  const chunks = [];
  let buffer = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push(trimmed);
    buffer = "";
  };

  blocks.forEach((block) => {
    if (block.length > IMPORT_CHUNK_HARD_LIMIT) {
      pushBuffer();
      splitBySentenceBudget(block, IMPORT_CHUNK_TARGET).forEach((piece) => {
        if (piece) chunks.push(piece);
      });
      return;
    }

    const next = buffer ? `${buffer}\n\n${block}` : block;
    if (next.length > IMPORT_CHUNK_HARD_LIMIT && buffer) {
      pushBuffer();
      buffer = block;
      return;
    }

    if (next.length > IMPORT_CHUNK_TARGET && buffer) {
      pushBuffer();
      buffer = block;
      return;
    }

    buffer = next;
  });

  pushBuffer();

  if (chunks.length <= 1) {
    return [{ title, content }];
  }

  return chunks.map((chunk, index) => ({
    title: `${title}（${index + 1}/${chunks.length}）`,
    content: chunk,
  }));
}

function splitBySentenceBudget(text, targetSize) {
  const normalized = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= IMPORT_CHUNK_HARD_LIMIT) return [normalized];

  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [normalized];
  const chunks = [];
  let buffer = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push(trimmed);
    buffer = "";
  };

  sentences.forEach((sentence) => {
    const part = sentence.trim();
    if (!part) return;
    if (part.length > IMPORT_CHUNK_HARD_LIMIT) {
      pushBuffer();
      for (let i = 0; i < part.length; i += targetSize) {
        chunks.push(part.slice(i, i + targetSize).trim());
      }
      return;
    }

    const next = buffer ? `${buffer} ${part}` : part;
    if (next.length > IMPORT_CHUNK_HARD_LIMIT && buffer) {
      pushBuffer();
      buffer = part;
      return;
    }

    if (next.length > targetSize && buffer) {
      pushBuffer();
      buffer = part;
      return;
    }

    buffer = next;
  });

  pushBuffer();
  return chunks;
}

function isHeadingLine(line) {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^第[一二三四五六七八九十0-9]+[章节部分篇讲课]/.test(line) ||
    /^[0-9]+\.[0-9]*\s+/.test(line) ||
    /^[一二三四五六七八九十]+[、.]\s*/.test(line) ||
    /^[（(][一二三四五六七八九十0-9]+[)）]\s*/.test(line)
  );
}

function normalizeHeading(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[0-9]+\.[0-9]*\s+/, "")
    .replace(/^[一二三四五六七八九十]+[、.]\s*/, "")
    .replace(/^[（(][一二三四五六七八九十0-9]+[)）]\s*/, "")
    .trim();
}

function deriveTitleFromContent(content, fallbackTitle, index) {
  const firstSentence = content
    .replace(/\s+/g, " ")
    .split(/[。！？?!]/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstSentence ? firstSentence.slice(0, 28) : `${fallbackTitle} · 片段 ${index + 1}`;
}

function inferTopic(source) {
  const lower = source.toLowerCase();
  const rules = [
    ["投资", ["投资", "基金", "股票", "债券", "财报", "估值", "资产配置", "etf", "finance", "macro"]],
    ["AI", ["ai", "llm", "gpt", "agent", "prompt", "模型", "机器学习", "深度学习", "embedding"]],
    ["生活", ["生活", "健康", "习惯", "复盘", "效率", "情绪", "运动", "作息", "阅读", "旅行"]],
  ];

  for (const [topic, keywords] of rules) {
    if (keywords.some((keyword) => lower.includes(keyword))) return topic;
  }

  return taxonomy.topics[0] || "未分类";
}

function inferType(extension, source) {
  const lower = source.toLowerCase();
  if (extension === "pdf" || extension === "docx") return "阅读";
  if (extension === "csv") return "练习";
  if (extension === "json") return "项目";
  if (lower.includes("总结") || lower.includes("复盘")) return "复盘";
  if (lower.includes("课程") || lower.includes("lesson")) return "课程";
  if (lower.includes("练习") || lower.includes("题")) return "练习";
  return taxonomy.types[0] || "阅读";
}

function inferTags(source, extension) {
  const lower = source.toLowerCase();
  const candidates = [
    ["投资", "投资"],
    ["基金", "基金"],
    ["股票", "股票"],
    ["AI", "ai"],
    ["Prompt", "prompt"],
    ["LLM", "llm"],
    ["生活", "生活"],
    ["复盘", "复盘"],
    ["健康", "健康"],
  ];

  const tags = candidates.filter(([, keyword]) => lower.includes(keyword)).map(([tag]) => tag);
  if (extension) tags.push(extension.toUpperCase());
  return uniqueArray(tags).slice(0, 6);
}

function inferNextAction(source, type) {
  if (type === "练习") return "回看错题并补充同类练习";
  if (type === "项目") return "把这次整理出的要点落到实际项目里";
  if (source.toLowerCase().includes("todo")) return "先处理内容里标记的 TODO 项";
  return "明天复盘这段内容，并补充关键结论";
}

function renderFileImportResults(results) {
  fileImportResults.innerHTML = "";
  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "import-result-card";
    card.innerHTML = result.ok
      ? `<strong>${escapeHtml(result.fileName)}</strong><p>${escapeHtml(result.message)}</p><p>标签：${result.tags.length ? escapeHtml(result.tags.join("、")) : "无"}</p>`
      : `<strong>${escapeHtml(result.fileName)}</strong><p>${escapeHtml(result.message)}</p>`;
    fileImportResults.appendChild(card);
  });
}

function mergeTagInput(current, nextTag) {
  return uniqueArray([...parseTags(current), nextTag]).join(", ");
}

function parseTags(value) {
  return uniqueArray(value.split(",").map((tag) => tag.trim()).filter(Boolean));
}

function normalizeDateLabel(raw) {
  return raw.replace(/[/.年]/g, "-").replace(/月/g, "-").replace(/日/g, "").replace(/--+/g, "-");
}

function archiveTopicAnchorId(topic) {
  return `archive-topic-${slugify(topic)}`;
}

function archiveRecordAnchorId(recordId) {
  return `archive-record-${recordId}`;
}

function currentArchiveHash() {
  return window.location.hash.replace(/^#/, "");
}

function openArchiveHash(hash) {
  const nextHash = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash === nextHash) {
    renderArchive(currentArchivedView);
    scrollToArchiveTarget();
    return;
  }
  window.location.hash = nextHash;
}

function scrollToArchiveTarget() {
  const hash = currentArchiveHash();
  if (!hash || archivePanel.hidden) return;

  requestAnimationFrame(() => {
    const target = document.getElementById(hash) || archivePanel;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-") || "item";
}

function polarToPoint(cx, cy, radius, angle) {
  return {
    x: Number((cx + Math.cos(angle) * radius).toFixed(2)),
    y: Number((cy + Math.sin(angle) * radius).toFixed(2)),
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function getExtension(fileName) {
  return fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
}

function statusClass(status) {
  if (status === "学习中") return "status-learning";
  if (status === "待复习") return "status-review";
  if (status === "已掌握") return "status-mastered";
  return "status-archived";
}

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortByRecent(a, b) {
  return new Date(b.updatedAt || b.studyDate) - new Date(a.updatedAt || a.studyDate);
}

function sortByArchived(a, b) {
  return new Date(b.archivedAt || b.updatedAt || b.studyDate) - new Date(a.archivedAt || a.updatedAt || a.studyDate);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
