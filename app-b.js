function renderBillList() {
  const listEl = document.getElementById("bill-list");
  const emptyEl = document.getElementById("bill-empty");
  const errorEl = document.getElementById("bill-error");
  if (!listEl) return;

  listEl.replaceChildren();
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  let records = [];
  try {
    records = loadRecords();
  } catch (err) {
    if (emptyEl) emptyEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = err.message || "无法读取账单";
    }
    return;
  }

  const items = [];
  let skipped = 0;
  for (const rec of sortRecords(records)) {
    const item = toBillItem(rec);
    if (item.ok) items.push(item);
    else skipped += 1;
  }

  if (emptyEl) emptyEl.hidden = items.length > 0;

  if (skipped > 0 && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = `有 ${skipped} 条记录无法显示`;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "bill-item";
    if (item.id) li.dataset.id = item.id;

    const front = document.createElement("div");
    front.className = "bill-front";

    const main = document.createElement("div");
    main.className = "bill-main";

    const cat = document.createElement("p");
    cat.className = "bill-cat";
    cat.textContent = item.category;

    const meta = document.createElement("p");
    meta.className = "bill-meta";
    meta.textContent = item.note
      ? `${formatDateLabel(item.date)} · ${item.note}`
      : formatDateLabel(item.date);

    main.append(cat, meta);

    const amount = document.createElement("span");
    amount.className = `bill-amount ${item.type === "income" ? "is-income" : "is-expense"}`;
    amount.textContent =
      (item.type === "income" ? "+" : "-") + formatMoney(item.amountCents).replace("-", "");

    front.append(main, amount);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "bill-delete";
    del.textContent = "删除";
    del.tabIndex = -1;
    del.addEventListener("click", () => {
      const label = `${item.category} ${amount.textContent}`;
      if (!window.confirm(`确定删除「${label}」？删除后无法恢复。`)) return;
      try {
        const result = deleteRecord(item.id);
        if (!result.ok) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = result.error;
          }
          return;
        }
      } catch (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = err.message || "删除失败";
        }
        return;
      }
      renderMonthSummary();
      renderBillList();
      renderPeriodSummary();
    });

    li.append(del, front);
    attachSwipeToDelete(li, front);
    listEl.append(li);
  }
}

function setView(view) {
  const titles = { add: "吴彦祖专属记账", list: "账单", summary: "汇总" };
  const shell = document.getElementById("app-shell");
  const form = document.getElementById("record-form");
  const panel = document.getElementById("bill-panel");
  const summary = document.getElementById("summary-panel");
  const monthSummary = document.getElementById("month-summary");
  const title = document.getElementById("page-title");
  const tabs = {
    add: document.getElementById("tab-add"),
    list: document.getElementById("tab-list"),
    summary: document.getElementById("tab-summary"),
  };
  const current = titles[view] ? view : "add";

  if (shell) shell.dataset.view = current;
  if (form) form.hidden = current !== "add";
  if (panel) panel.hidden = current !== "list";
  if (summary) summary.hidden = current !== "summary";
  if (monthSummary) monthSummary.hidden = current === "summary";
  if (title) title.textContent = titles[current];

  for (const [name, tab] of Object.entries(tabs)) {
    if (!tab) continue;
    const on = name === current;
    tab.classList.toggle("is-on", on);
    if (on) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
}

function renderMonthSummary() {
  const labelEl = document.getElementById("month-label");
  const incomeEl = document.getElementById("month-income");
  const expenseEl = document.getElementById("month-expense");
  const balanceEl = document.getElementById("month-balance");
  const warnEl = document.getElementById("month-warn");
  if (!incomeEl || !expenseEl || !balanceEl) return;

  const monthKey = currentMonthKey();
  if (labelEl) labelEl.textContent = `本月 · ${formatMonthLabel(monthKey)}`;

  let records = [];
  try {
    records = loadRecords();
  } catch (err) {
    incomeEl.textContent = formatMoney(0);
    expenseEl.textContent = formatMoney(0);
    balanceEl.textContent = formatMoney(0);
    balanceEl.className = "is-zero";
    if (warnEl) {
      warnEl.hidden = false;
      warnEl.textContent = err.message || "无法读取本月数据";
    }
    return;
  }

  const sum = summarizeMonth(records, monthKey);
  fillMoneyTriple(incomeEl, expenseEl, balanceEl, sum);
  if (warnEl) {
    if (sum.skipped > 0) {
      warnEl.hidden = false;
      warnEl.textContent = `有 ${sum.skipped} 条记录无法计入本月`;
    } else {
      warnEl.hidden = true;
      warnEl.textContent = "";
    }
  }
}

function fillSelect(select, options, selected) {
  select.innerHTML = "";
  for (const option of options) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === selected) opt.selected = true;
    select.append(opt);
  }
}

function renderPieChart({ pieEl, legendEl, totalEl, type, slices, total }) {
  if (!pieEl || !legendEl || !totalEl) return;
  totalEl.textContent = formatMoney(total);
  legendEl.replaceChildren();
  const empty = slices.length === 0;
  pieEl.classList.toggle("is-empty", empty);
  pieEl.style.background = empty ? "" : pieBackground(slices);
  if (empty) {
    const li = document.createElement("li");
    li.className = "legend-empty";
    li.textContent = type === "expense" ? "暂无支出" : "暂无收入";
    legendEl.append(li);
    return;
  }
  for (const slice of slices) {
    const li = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = "swatch";
    swatch.style.background = slice.color;
    const name = document.createElement("span");
    name.textContent = slice.category;
    const pct = document.createElement("span");
    pct.className = "pct";
    pct.textContent = slice.pct > 0 ? `${slice.pct}%` : "<1%";
    li.append(swatch, name, pct);
    legendEl.append(li);
  }
}

function setSummaryMode(mode) {
  selectedSummaryMode = mode === "month" ? "month" : "year";
  const yearBtn = document.getElementById("mode-year");
  const monthBtn = document.getElementById("mode-month");
  if (yearBtn) yearBtn.classList.toggle("is-on", selectedSummaryMode === "year");
  if (monthBtn) monthBtn.classList.toggle("is-on", selectedSummaryMode === "month");
  renderPeriodSummary();
}

function renderPeriodSummary() {
  const periodSelect = document.getElementById("period-select");
  const fieldLabel = document.getElementById("period-field-label");
  const incomeEl = document.getElementById("year-income");
  const expenseEl = document.getElementById("year-expense");
  const balanceEl = document.getElementById("year-balance");
  const labelEl = document.getElementById("period-label");
  const warnEl = document.getElementById("year-warn");
  const errorEl = document.getElementById("summary-error");
  const expensePie = document.getElementById("expense-pie");
  const incomePie = document.getElementById("income-pie");
  if (!incomeEl || !expenseEl || !balanceEl) return;

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  let records = [];
  try {
    records = loadRecords();
  } catch (err) {
    fillMoneyTriple(incomeEl, expenseEl, balanceEl, {
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
    });
    renderPieChart({
      pieEl: expensePie,
      legendEl: document.getElementById("expense-legend"),
      totalEl: document.getElementById("expense-pie-total"),
      type: "expense",
      slices: [],
      total: 0,
    });
    renderPieChart({
      pieEl: incomePie,
      legendEl: document.getElementById("income-legend"),
      totalEl: document.getElementById("income-pie-total"),
      type: "income",
      slices: [],
      total: 0,
    });
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = err.message || "无法读取汇总";
    }
    return;
  }

  const isMonth = selectedSummaryMode === "month";
  const years = collectYears(records);
  const months = collectMonths(records);
  if (!selectedYearKey || !years.includes(selectedYearKey)) {
    selectedYearKey = currentMonthKey().slice(0, 4);
  }
  if (!selectedMonthKey || !months.includes(selectedMonthKey)) {
    selectedMonthKey = currentMonthKey();
  }

  if (fieldLabel) fieldLabel.textContent = isMonth ? "月份" : "年份";
  if (periodSelect) {
    if (isMonth) {
      fillSelect(
        periodSelect,
        months.map((key) => ({ value: key, label: formatMonthLabel(key) })),
        selectedMonthKey
      );
    } else {
      fillSelect(
        periodSelect,
        years.map((year) => ({ value: year, label: `${year}年` })),
        selectedYearKey
      );
    }
  }

  const prefix = isMonth ? selectedMonthKey : `${selectedYearKey}-`;
  if (labelEl) {
    labelEl.textContent = isMonth
      ? `月账单 · ${formatMonthLabel(selectedMonthKey)}`
      : `年账单 · ${selectedYearKey}年`;
  }

  const periodSum = isMonth
    ? summarizeMonth(records, selectedMonthKey)
    : summarizeYear(records, selectedYearKey);
  fillMoneyTriple(incomeEl, expenseEl, balanceEl, periodSum);
  if (warnEl) {
    if (periodSum.skipped > 0) {
      warnEl.hidden = false;
      warnEl.textContent = isMonth
        ? `有 ${periodSum.skipped} 条记录无法计入本月`
        : `有 ${periodSum.skipped} 条记录无法计入本年`;
    } else {
      warnEl.hidden = true;
      warnEl.textContent = "";
    }
  }

  const expensePieData = toPieSlices(summarizeByCategory(records, prefix, "expense").rows, "expense");
  const incomePieData = toPieSlices(summarizeByCategory(records, prefix, "income").rows, "income");
  renderPieChart({
    pieEl: expensePie,
    legendEl: document.getElementById("expense-legend"),
    totalEl: document.getElementById("expense-pie-total"),
    type: "expense",
    slices: expensePieData.slices,
    total: expensePieData.total,
  });
  renderPieChart({
    pieEl: incomePie,
    legendEl: document.getElementById("income-legend"),
    totalEl: document.getElementById("income-pie-total"),
    type: "income",
    slices: incomePieData.slices,
    total: incomePieData.total,
  });
}

window.Jizhang = {
  STORAGE_KEY,
  CUSTOM_CATEGORY,
  CATEGORIES,
  CATEGORY_COLORS,
  parseAmountToCents,
  createRecord,
  loadRecords,
  saveRecord,
  deleteRecord,
  formatYuan,
  formatMoney,
  fillCategorySelect,
  currentMonthKey,
  formatMonthLabel,
  summarizeMonth,
  summarizeYear,
  collectYears,
  collectMonths,
  summarizeByCategory,
  toPieSlices,
  pieBackground,
  renderMonthSummary,
  renderPeriodSummary,
  setSummaryMode,
  formatDateLabel,
  sortRecords,
  toBillItem,
  renderBillList,
  setView,
};

function initForm() {
  const form = document.getElementById("record-form");
  if (!form) return;

  const amountInput = document.getElementById("amount");
  const categorySelect = document.getElementById("category");
  const dateInput = document.getElementById("date");
  const noteInput = document.getElementById("note");
  const noteLabel = document.getElementById("note-label");
  const noteHint = document.getElementById("note-hint");
  const errorEl = document.getElementById("form-error");
  const okEl = document.getElementById("form-ok");

  dateInput.value = todayISO();
  fillCategorySelect(categorySelect, "expense");
  syncCustomNoteField(categorySelect, noteInput, noteLabel, noteHint);

  form.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      fillCategorySelect(categorySelect, radio.value, categorySelect.value);
      syncCustomNoteField(categorySelect, noteInput, noteLabel, noteHint);
    });
  });
  categorySelect.addEventListener("change", () => {
    syncCustomNoteField(categorySelect, noteInput, noteLabel, noteHint);
  });

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
    okEl.hidden = true;
    okEl.textContent = "";
  }

  function showOk(message) {
    okEl.hidden = false;
    okEl.textContent = message;
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const type = form.querySelector('input[name="type"]:checked')?.value;
    const result = createRecord({
      type,
      amountRaw: amountInput.value,
      category: categorySelect.value,
      date: dateInput.value,
      note: noteInput.value,
    });
    if (!result.ok) {
      showError(result.error);
      return;
    }
    try {
      saveRecord(result.record);
    } catch (err) {
      showError(err.message || "保存失败");
      return;
    }
    const label = result.record.type === "income" ? "收入" : "支出";
    const extra =
      result.record.category === CUSTOM_CATEGORY && result.record.note
        ? `（${result.record.note}）`
        : "";
    showOk(
      `已记下${label} · ${result.record.category}${extra} ¥${formatYuan(result.record.amountCents)}`
    );
    amountInput.value = "";
    noteInput.value = "";
    syncCustomNoteField(categorySelect, noteInput, noteLabel, noteHint);
    renderMonthSummary();
    renderBillList();
    renderPeriodSummary();
    amountInput.focus();
  });

  const tabAdd = document.getElementById("tab-add");
  const tabList = document.getElementById("tab-list");
  const tabSummary = document.getElementById("tab-summary");
  const periodSelect = document.getElementById("period-select");
  const modeYear = document.getElementById("mode-year");
  const modeMonth = document.getElementById("mode-month");
  if (tabAdd) tabAdd.addEventListener("click", () => setView("add"));
  if (tabList) tabList.addEventListener("click", () => setView("list"));
  if (tabSummary) tabSummary.addEventListener("click", () => setView("summary"));
  if (modeYear) modeYear.addEventListener("click", () => setSummaryMode("year"));
  if (modeMonth) modeMonth.addEventListener("click", () => setSummaryMode("month"));
  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      if (selectedSummaryMode === "month") selectedMonthKey = periodSelect.value;
      else selectedYearKey = periodSelect.value;
      renderPeriodSummary();
    });
  }

  renderMonthSummary();
  renderBillList();
  renderPeriodSummary();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initForm);
} else {
  initForm();
}
