const STORAGE_KEY = "jizhang.records.v1";
const MAX_YUAN = 999999999.99;
const CUSTOM_CATEGORY = "自定义";
const CATEGORIES = {
  expense: ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "孩子", "其他", CUSTOM_CATEGORY],
  income: ["工资", "奖金", "理财", "报销", "孩子", "其他", CUSTOM_CATEGORY],
};
const CATEGORY_COLORS = {
  expense: {
    餐饮: "#c2473a",
    交通: "#2f6fed",
    购物: "#e39b1a",
    居住: "#6b4f3a",
    娱乐: "#7b4b9a",
    医疗: "#1a9b8a",
    孩子: "#d45d8a",
    其他: "#8a8175",
    自定义: "#b85c38",
  },
  income: {
    工资: "#1f6f4a",
    奖金: "#3d9b6a",
    理财: "#2a7f9e",
    报销: "#c46b1f",
    孩子: "#d45d8a",
    其他: "#8a8175",
    自定义: "#b85c38",
  },
};
const UNKNOWN_CATEGORY_COLOR = "#5c6670";

function parseAmountToCents(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: false, error: "请输入金额" };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "金额须为不超过两位小数的正数" };
  }
  const yuan = Number(text);
  if (!Number.isFinite(yuan) || yuan <= 0) {
    return { ok: false, error: "金额必须大于 0" };
  }
  if (yuan > MAX_YUAN) {
    return { ok: false, error: "金额过大" };
  }
  return { ok: true, cents: Math.round(yuan * 100) };
}

function createRecord({ type, amountRaw, category, customCategory, date, note }) {
  if (type !== "income" && type !== "expense") {
    return { ok: false, error: "请选择收入或支出" };
  }
  const amount = parseAmountToCents(amountRaw);
  if (!amount.ok) return amount;
  let cat = String(category ?? "").trim();
  const allowed = CATEGORIES[type] || [];
  if (!cat) return { ok: false, error: "请选择分类" };
  if (cat === CUSTOM_CATEGORY) {
    cat = String(customCategory ?? "").trim();
    if (!cat) return { ok: false, error: "请填写你想记录的分类名" };
    if (cat.length > 20) return { ok: false, error: "分类名最多 20 个字" };
  } else if (!allowed.includes(cat)) {
    return { ok: false, error: "分类与收支类型不匹配" };
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "请选择有效日期" };
  }
  const trimmedNote = String(note ?? "").trim();
  if (trimmedNote.length > 80) {
    return { ok: false, error: "备注最多 80 个字" };
  }
  return {
    ok: true,
    record: {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type,
      amountCents: amount.cents,
      category: cat,
      date,
      note: trimmedNote,
      createdAt: Date.now(),
    },
  };
}

function syncCustomCategoryField(categorySelect, wrap, input) {
  const custom = categorySelect?.value === CUSTOM_CATEGORY;
  if (wrap) wrap.hidden = !custom;
  if (input) input.classList.toggle("note-hit", custom);
}

function fillCategorySelect(select, type, selected) {
  const list = CATEGORIES[type] || [];
  const keep = list.includes(selected) ? selected : list[0] || "";
  select.innerHTML = "";
  for (const name of list) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === keep) opt.selected = true;
    select.appendChild(opt);
  }
  renderCategoryPicker(select);
}

function closeCategoryMenu() {
  const menu = document.getElementById("category-menu");
  const btn = document.getElementById("category-btn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function renderCategoryPicker(select) {
  const btn = document.getElementById("category-btn");
  const menu = document.getElementById("category-menu");
  if (btn) btn.textContent = select.value || "请选择分类";
  if (!menu) return;
  menu.replaceChildren();
  for (const opt of [...select.options]) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.textContent = opt.value;
    li.dataset.value = opt.value;
    if (opt.selected) li.classList.add("is-on");
    li.addEventListener("click", () => {
      select.value = opt.value;
      select.dispatchEvent(new Event("change"));
      renderCategoryPicker(select);
      closeCategoryMenu();
    });
    menu.append(li);
  }
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("not-array");
    }
    return data;
  } catch (err) {
    throw new Error("本地账本数据已损坏，未写入新记录");
  }
}

function saveRecord(record) {
  const records = loadRecords();
  records.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return records;
}

function deleteRecord(id) {
  const key = String(id ?? "").trim();
  if (!key) return { ok: false, error: "这笔账单没有编号，无法删除" };
  const records = loadRecords();
  const matched = records.filter((rec) => rec && rec.id === key);
  if (matched.length === 0) return { ok: false, error: "找不到这笔账单" };
  if (matched.length > 1) return { ok: false, error: "账单编号重复，未删除" };
  const next = records.filter((rec) => !rec || rec.id !== key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { ok: true, records: next };
}

function formatYuan(cents) {
  return (cents / 100).toFixed(2);
}

function formatMoney(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-");
  return `${year}年${Number(month)}月`;
}

function summarizeByDatePrefix(records, prefix) {
  let incomeCents = 0;
  let expenseCents = 0;
  let skipped = 0;
  for (const rec of records) {
    if (!rec || typeof rec.date !== "string" || !rec.date.startsWith(prefix)) {
      continue;
    }
    const cents = Number(rec.amountCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      skipped += 1;
      continue;
    }
    if (rec.type === "income") incomeCents += cents;
    else if (rec.type === "expense") expenseCents += cents;
    else skipped += 1;
  }
  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    skipped,
  };
}

function summarizeMonth(records, monthKey) {
  return { monthKey, ...summarizeByDatePrefix(records, monthKey) };
}

function summarizeYear(records, yearKey) {
  return { yearKey, ...summarizeByDatePrefix(records, `${yearKey}-`) };
}

function collectYears(records, now = new Date()) {
  const years = new Set([String(now.getFullYear())]);
  for (const rec of records) {
    if (typeof rec?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rec.date)) {
      years.add(rec.date.slice(0, 4));
    }
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

function collectMonths(records, now = new Date()) {
  const months = new Set([currentMonthKey(now)]);
  for (const rec of records) {
    if (typeof rec?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rec.date)) {
      months.add(rec.date.slice(0, 7));
    }
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}

function categoryColor(type, category) {
  const map = CATEGORY_COLORS[type] || {};
  if (map[category]) return map[category];
  if (!category || category === "未分类") return UNKNOWN_CATEGORY_COLOR;
  return map[CUSTOM_CATEGORY] || UNKNOWN_CATEGORY_COLOR;
}

function summarizeByCategory(records, prefix, type) {
  const totals = new Map();
  let skipped = 0;
  for (const rec of records) {
    if (!rec || rec.type !== type || typeof rec.date !== "string" || !rec.date.startsWith(prefix)) {
      continue;
    }
    const cents = Number(rec.amountCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      skipped += 1;
      continue;
    }
    const cat = String(rec.category || "").trim() || "未分类";
    totals.set(cat, (totals.get(cat) || 0) + cents);
  }
  const rows = [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .filter((row) => row.cents > 0);
  return { rows, skipped };
}

function toPieSlices(rows, type) {
  const positive = rows.filter((row) => row.cents > 0).sort((a, b) => b.cents - a.cents);
  const total = positive.reduce((sum, row) => sum + row.cents, 0);
  if (!total) return { total: 0, slices: [] };
  const slices = positive.map((row) => ({
    category: row.category,
    cents: row.cents,
    color: categoryColor(type, row.category),
    rawPct: (row.cents / total) * 100,
    pct: 0,
  }));
  for (const slice of slices) slice.pct = Math.floor(slice.rawPct);
  let leftover = 100 - slices.reduce((sum, slice) => sum + slice.pct, 0);
  const order = slices
    .map((slice, index) => ({ index, frac: slice.rawPct - slice.pct }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < leftover; i += 1) {
    slices[order[i % order.length].index].pct += 1;
  }
  return { total, slices };
}

function pieBackground(slices) {
  const usable = slices.filter((slice) => slice.pct > 0);
  if (!usable.length) return "";
  if (usable.length === 1) return usable[0].color;
  let start = 0;
  const stops = [];
  for (const slice of usable) {
    const end = start + slice.pct;
    stops.push(`${slice.color} ${start}% ${end}%`);
    start = end;
  }
  if (start < 100) {
    stops.push(`${usable[usable.length - 1].color} ${start}% 100%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function balanceClass(cents) {
  return cents < 0 ? "is-negative" : cents > 0 ? "is-positive" : "is-zero";
}

function fillMoneyTriple(incomeEl, expenseEl, balanceEl, sum) {
  incomeEl.textContent = formatMoney(sum.incomeCents);
  expenseEl.textContent = formatMoney(sum.expenseCents);
  balanceEl.textContent = formatMoney(sum.balanceCents);
  balanceEl.className = `${balanceEl.className
    .split(" ")
    .filter((name) => name && !name.startsWith("is-"))
    .join(" ")} ${balanceClass(sum.balanceCents)}`.trim();
}

let selectedYearKey = "";
let selectedMonthKey = "";
let selectedSummaryMode = "year";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function formatDateLabel(date, now = new Date()) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "日期未知";
  }
  const [year, month, day] = date.split("-");
  const md = `${Number(month)}月${Number(day)}日`;
  return Number(year) === now.getFullYear() ? md : `${year}年${md}`;
}

function weekdayLabel(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return "";
  return WEEKDAYS[dt.getDay()];
}

function formatBillDayLabel(date, now = new Date()) {
  const day = formatDateLabel(date, now);
  const week = weekdayLabel(date);
  return week ? `${day} ${week}` : day;
}

function sortRecords(records) {
  return records.slice().sort((a, b) => {
    const da = typeof a?.date === "string" ? a.date : "";
    const db = typeof b?.date === "string" ? b.date : "";
    if (da !== db) return db.localeCompare(da);
    return (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0);
  });
}

function toBillItem(rec) {
  if (!rec || typeof rec !== "object") return { ok: false };
  const type = rec.type === "income" || rec.type === "expense" ? rec.type : null;
  const cents = Number(rec.amountCents);
  const dateOk = typeof rec.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rec.date);
  if (!type || !dateOk || !Number.isFinite(cents) || cents <= 0) {
    return { ok: false };
  }
  return {
    ok: true,
    id: rec.id || "",
    type,
    category: String(rec.category || "").trim() || "未分类",
    date: rec.date,
    note: String(rec.note || "").trim(),
    amountCents: cents,
    createdAt: Number(rec.createdAt) || 0,
  };
}

function groupBillsByDate(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const key = item.date;
    let group = map.get(key);
    if (!group) {
      group = {
        date: key,
        label: formatBillDayLabel(key),
        incomeCents: 0,
        expenseCents: 0,
        items: [],
      };
      map.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
    if (item.type === "income") group.incomeCents += item.amountCents;
    else group.expenseCents += item.amountCents;
  }
  return groups;
}

const SWIPE_DELETE_WIDTH = 72;

function closeOpenBills(except) {
  document.querySelectorAll(".bill-item.is-open").forEach((el) => {
    if (el === except) return;
    el.classList.remove("is-open");
    const front = el.querySelector(".bill-front");
    if (front) {
      front.style.transition = "transform 0.2s ease";
      front.style.transform = "translateX(0)";
    }
  });
}

function attachSwipeToDelete(item, front) {
  let startX = 0;
  let startY = 0;
  let base = 0;
  let dx = 0;
  let tracking = false;
  let axis = null;
  let pointerId = null;

  function apply(x, animate) {
    front.style.transition = animate ? "transform 0.2s ease" : "none";
    front.style.transform = `translateX(${x}px)`;
  }

  function snap(open) {
    item.classList.toggle("is-open", open);
    apply(open ? -SWIPE_DELETE_WIDTH : 0, true);
  }

  function onMove(event) {
    if (!tracking || event.pointerId !== pointerId) return;
    const mx = event.clientX - startX;
    const my = event.clientY - startY;
    if (!axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (axis === "x") {
        item.classList.add("is-dragging");
        closeOpenBills(item);
      }
    }
    if (axis !== "x") return;
    event.preventDefault();
    dx = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, base + mx));
    apply(dx, false);
  }

  function onUp(event) {
    if (!tracking || event.pointerId !== pointerId) return;
    tracking = false;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    item.classList.remove("is-dragging");
    if (axis === "x") snap(dx < -SWIPE_DELETE_WIDTH / 2);
    else if (item.classList.contains("is-open")) snap(false);
    axis = null;
    pointerId = null;
  }

  front.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    tracking = true;
    axis = null;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    base = item.classList.contains("is-open") ? -SWIPE_DELETE_WIDTH : 0;
    dx = base;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}
