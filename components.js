// ===== UI COMPONENTS =====

function expenseCategoryInfo(expense) {
  const category = expense.category || "";
  const amount = Number(expense.amount || 0);
  if (category === "litacka" || /l[ií]ta[cč]ka|pid/i.test(expense.description || "")) {
    const known = {
      36: ["30 min", 1], 46: ["90 min", 1], 140: ["24 h", 1],
      72: ["30 min", 2], 108: ["30 min", 3], 144: ["30 min", 4],
      92: ["90 min", 2], 280: ["24 h", 2]
    };
    if (known[amount]) return { label: "Lítačka", icon: "🚇", subtype: known[amount][0], qty: known[amount][1] };
    return { label: "Lítačka", icon: "🚇", subtype: expense.subtype || "jízdenka", qty: Number(expense.quantity || 1) };
  }
  if (category === "csad" || /čsad/i.test(expense.description || "")) return { label: "ČSAD", icon: "🚌", subtype: "jízdenka", qty: 1 };
  return { label: expense.description || "Výdaj", icon: "", subtype: "", qty: 1 };
}

function renderExpenseSummary(expenses) {
  const grouped = new Map();
  for (const expense of expenses) {
    const info = expenseCategoryInfo(expense);
    const key = info.label;
    if (!grouped.has(key)) grouped.set(key, { ...info, amount: 0, items: [] });
    const g = grouped.get(key);
    g.amount += Number(expense.amount || 0);
    if (info.subtype) g.items.push({ subtype: info.subtype, qty: info.qty });
  }

  return [...grouped.values()].map(g => {
    let detail = "";
    if (g.label === "Lítačka") {
      const counts = {};
      for (const item of g.items) counts[item.subtype] = (counts[item.subtype] || 0) + item.qty;
      detail = Object.entries(counts).map(([name, qty]) => `${qty}× ${name}`).join(", ");
    } else if (g.label === "ČSAD") {
      detail = `${g.items.reduce((n, i) => n + i.qty, 0)}× jízdenka`;
    }
    return `<div class="expense expense-summary-row"><div><strong>${g.icon} ${escapeHtml(g.label)}</strong>${detail ? `<span class="expense-detail">(${escapeHtml(detail)})</span>` : ""}</div><strong>${money(g.amount)}</strong></div>`;
  }).join("");
}

class DayDetailRenderer {
  constructor(ticketManager, expenseManager, workPlanManager) {
    this.ticketManager = ticketManager;
    this.expenseManager = expenseManager;
    this.workPlanManager = workPlanManager;
  }

  render(dateKey) {
    const tickets = this.ticketManager.getForDate(dateKey);
    const expenses = this.expenseManager.getForDate(dateKey);
    const isPlanned = this.workPlanManager.isPlanned(dateKey);
    const dayType = this.workPlanManager.getDayType(dateKey);
    const expenseCost = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return `
      <div class="panel">
        <div class="panel-title">
          <div>
            <h2>${escapeHtml(fmtDate(dateKey))}</h2>
            <div class="muted">Detail pracovního dne</div>
          </div>
        </div>

        <div class="day-section">
          <div class="day-section-head"><h3>📌 Stav dne</h3></div>
          <div class="plan-toggle">
            <button class="btn ${dayType === "normal" ? "btn-primary" : ""}" data-action="set-day-type" data-date="${dateKey}" data-type="normal">🏢 Praha / běžný den</button>
            <button class="btn ${dayType === "homeoffice" ? "btn-primary" : ""}" data-action="set-day-type" data-date="${dateKey}" data-type="homeoffice">🏠 HO</button>
            <button class="btn ${dayType === "vacation" ? "btn-primary" : ""}" data-action="set-day-type" data-date="${dateKey}" data-type="vacation">🏖️ Dovolená</button>
          </div>
          ${dayType === "normal" ? `
            <div class="plan-toggle" style="margin-top:8px;">
              <button class="btn ${!isPlanned ? 'btn-primary' : ''}" data-action="set-plan" data-date="${dateKey}" data-value="0">○ Neplánuji Prahu</button>
              <button class="btn ${isPlanned ? 'btn-primary' : ''}" data-action="set-plan" data-date="${dateKey}" data-value="1">● Plánuji Prahu</button>
            </div>` : ""}
        </div>

        <div class="day-section">
          <div class="day-section-head">
            <h3>🚆 Jízdenky</h3>
            <button class="btn btn-primary btn-small" data-action="toggle-train-options">＋ Přidat vlak</button>
          </div>
          ${this.renderAddTrainBox()}
          ${tickets.length ? `<div class="ticket-list" style="margin-top:10px;">${tickets.map(t => this.renderTicket(t)).join("")}</div>` : `<div class="muted" style="margin-top:10px;">Žádné jízdenky pro tento den.</div>`}
        </div>

        <div class="day-section" style="margin-bottom:0;">
          <div class="day-section-head">
            <h3>💸 Denní výdaje <span class="daily-total">${money(expenseCost)}</span></h3>
            <button class="btn btn-small" data-action="open-expense" data-date="${dateKey}">＋ Přidat výdaj</button>
          </div>
          ${expenses.length ? `<div class="expense-summary-list">${renderExpenseSummary(expenses)}</div>` : `<div class="muted">Žádné běžné výdaje.</div>`}
          ${expenses.length ? `<details class="expense-details"><summary>Detail plateb</summary>${expenses.map(e => `<div class="expense"><div>${escapeHtml(e.description || "Výdaj")}</div><strong>${money(e.amount)}</strong></div>`).join("")}</details>` : ""}
        </div>
      </div>
    `;
  }

  renderAddTrainBox() {
    return `
      <div class="add-train-box" style="display:none">
        <div class="muted">Vyber předvolbu vlaku:</div>
        <div class="train-options">
          <button type="button" class="train-option" data-action="add-preset" data-preset="morningEN"><strong>🌅 EN 442</strong><span>Bohumín → Praha · 600 Kč</span></button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="morningPendolino"><strong>🚄 Ranní SC Pendolino</strong><span>Bohumín → Praha · 600 Kč</span></button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="afternoonEx"><strong>🚆 IC 547</strong><span>Praha → Bohumín · 500 Kč</span></button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="eveningPendolino"><strong>🌙 Večerní SC Pendolino</strong><span>Praha → Bohumín · 450 Kč</span></button>
        </div>
      </div>
    `;
  }

  renderTicket(ticket) {
    const cancelled = this.ticketManager.isCancelled(ticket);
    const status = this.ticketManager.getStatus(ticket);
    const type = ticket.ticketType || "main";
    const trainDisplay = normalizeTrainName(ticket.train);
    let statusHtml = "";

    if (cancelled) statusHtml = `<span class="badge badge-cancelled">STORNOVÁNO</span>`;
    else if (status === "done") statusHtml = `<span class="badge badge-done">USKUTEČNĚNO</span>`;
    else statusHtml = `<span class="badge badge-planned">PLÁN</span>`;

    return `
      <div class="ticket ${cancelled ? "cancelled" : ""} ${type === "partial" ? "ticket-partial" : "ticket-main"}">
        <div class="ticket-head">
          <div>
            <div class="train-name">${escapeHtml(trainDisplay)} <span class="ticket-type-badge">${type === "partial" ? "POJISTNÁ" : "HLAVNÍ"}</span>${ticket.quiet ? ` <span class="quiet-mark" title="Tiché kupé">🤫</span>` : ""}</div>
            <div class="route">${escapeHtml(ticket.from)} → ${escapeHtml(ticket.to)}</div>
            <div class="time">${escapeHtml(ticket.dep)} → ${escapeHtml(ticket.arr)} (${ticket.km || 0} km)</div>
          </div>
          <div>${statusHtml}</div>
        </div>
        <div class="ticket-meta">
          ${ticket.car ? `Vůz ${escapeHtml(ticket.car)}` : ""}
          ${ticket.seat ? ` · místo ${escapeHtml(ticket.seat)}` : ""}
          ${ticket.quiet ? ` · 🤫 tiché kupé` : ""}
          ${type === "main" ? ` · ${money(getFixedTrainPrice(ticket))}` : " · mimo statistiky"}
        </div>
        <div class="ticket-actions">
          ${cancelled ? `<button type="button" class="btn btn-success btn-small" data-action="restore-ticket" data-id="${ticket.id}">↩ Obnovit jízdenku</button>` : `
            <button type="button" class="btn btn-small" data-action="edit-ticket" data-id="${ticket.id}">✏️ Upravit</button>
            <button type="button" class="btn btn-danger btn-small" data-action="cancel-ticket" data-id="${ticket.id}">🚫 Stornovat</button>`}
        </div>
      </div>
    `;
  }
}

class CalendarRenderer {
  constructor(ticketManager, expenseManager, workPlanManager) {
    this.ticketManager = ticketManager;
    this.expenseManager = expenseManager;
    this.workPlanManager = workPlanManager;
  }

  render(year, month) {
    const monthName = new Date(year, month).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
    let html = `<div class="panel"><div class="calendar-header"><button data-action="prev-month">‹</button><div class="calendar-title">${monthName}</div><button data-action="next-month">›</button></div><div class="calendar-legend"><span class="legend-praha">✓ Praha</span><span>🏠 HO</span><span>🏖️ dovolená</span><span>• výdaj</span></div><div class="calendar-grid">
      <div class="calendar-weekday">Po</div><div class="calendar-weekday">Út</div><div class="calendar-weekday">St</div><div class="calendar-weekday">Čt</div><div class="calendar-weekday">Pá</div><div class="calendar-weekday weekend">So</div><div class="calendar-weekday weekend">Ne</div>`;

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day empty"></div>`;

    const days = daysInMonth(year, month);
    const currentKey = todayKey();

    for (let day = 1; day <= days; day++) {
      const key = keyFromDate(year, month, day);
      const dObj = new Date(key + "T12:00:00");
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      const tickets = this.ticketManager.getForDate(key);
      const validTickets = tickets.filter(t => this.ticketManager.isValid(t));
      const mainTickets = validTickets.filter(t => (t.ticketType || "main") === "main").sort((a,b) => (a.dep||"").localeCompare(b.dep||""));
      const partialTickets = validTickets.filter(t => (t.ticketType || "main") === "partial");
      const executedMainTickets = mainTickets.filter(t => this.ticketManager.getStatus(t) === "done");
      const dayType = this.workPlanManager.getDayType(key);
      const isToday = key === currentKey;
      const hasExpense = this.expenseManager.getForDate(key).length > 0;
      const extraCount = Math.max(0, mainTickets.length - 2) + partialTickets.length;

      let ticketLines = mainTickets.slice(0, 2).map(t => `
        <div class="calendar-ticket main-ticket">
          <strong>${escapeHtml(normalizeTrainName(t.train))}</strong><span>${escapeHtml(t.dep || "")}</span>${t.quiet ? `<span class="quiet-calendar" title="Tiché kupé">🤫</span>` : ""}
        </div>`).join("");
      if (extraCount) ticketLines += `<div class="calendar-ticket-more">+${extraCount} další</div>`;

      let stateMark = "";
      if (dayType === "vacation") stateMark = `<span class="day-state vacation" title="Dovolená">🏖️ DOVOLENÁ</span>`;
      else if (dayType === "homeoffice") stateMark = `<span class="day-state homeoffice" title="Home office">🏠 HO</span>`;
      else if (executedMainTickets.length) stateMark = `<span class="day-state executed" title="Praha uskutečněna">✓</span>`;
      if (hasExpense) stateMark += `<span class="expense-mark" title="Výdaj">•</span>`;

      html += `<div class="calendar-day ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""} ${dayType !== "normal" ? `day-${dayType}` : ""} ${executedMainTickets.length ? "day-executed" : ""}" data-action="select-day" data-date="${key}">
        <div class="calendar-number"><span>${day}</span><div class="day-indicators">${stateMark}</div></div>
        <div class="calendar-tickets">${ticketLines}</div>
      </div>`;
    }

    html += `</div></div>`;
    return html;
  }
}

class StatsRenderer {
  constructor(statsCalculator) { this.statsCalculator = statsCalculator; }

  render() {
    const attendance = this.statsCalculator.getAttendance();
    const monthKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const stats = this.statsCalculator.getMonthStats(monthKey);
    const taxiExp = stats.expenses.filter(e => (e.description || "").toLowerCase().includes("taxi"));
    const taxiTotal = taxiExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return `<div class="panel"><div class="panel-title"><div><h2>📊 Celkové statistiky</h2><div class="muted">Aktuální měsíc (k dnešnímu dni)</div></div></div><div class="stats-grid">
      <div class="stat-card"><div class="big">${stats.ticketCount}</div><div class="small">uskutečněné hlavní jízdy</div></div>
      <div class="stat-card"><div class="big">${stats.totalKm} km</div><div class="small">ujeto ve vlaku</div></div>
      <div class="stat-card"><div class="big">${formatDuration(stats.totalMinutes)}</div><div class="small">čas ve vlaku</div></div>
      <div class="stat-card"><div class="big">${money(stats.trainCost)}</div><div class="small">za hlavní jízdenky</div></div>
      <div class="stat-card"><div class="big">${money(stats.expenseCost)}</div><div class="small">ostatní výdaje</div></div>
      <div class="stat-card"><div class="big">${taxiExp.length}× (${money(taxiTotal)})</div><div class="small">výdaje za taxi</div></div>
    </div></div>
    <div class="panel"><div class="panel-title"><div><h3>🏢 Docházka do kanceláře</h3><div class="muted">Podíl odpracovaných dnů z dosavadních pracovních dnů měsíce</div></div></div><div style="font-size:28px;font-weight:bold">${attendance ? "20 % plán HO" : "0 %"}</div><div class="muted">Výchozí plán Home Office: 20 % pracovních dnů. Konkrétní dny lze měnit v detailu dne.</div></div>`;
  }
}
