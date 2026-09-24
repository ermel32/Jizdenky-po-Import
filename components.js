// ===== UI COMPONENTS =====

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
          <div class="day-section-head"><h3>🏢 Práce v Praze</h3></div>
          <div class="plan-toggle">
            <button class="btn ${!isPlanned ? 'btn-primary' : ''}" data-action="set-plan" data-date="${dateKey}" data-value="0">○ Neplánuji</button>
            <button class="btn ${isPlanned ? 'btn-primary' : ''}" data-action="set-plan" data-date="${dateKey}" data-value="1">● Plánuji Prahu</button>
          </div>
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
            <h3>💸 Denní výdaje</h3>
            <button class="btn btn-small" data-action="open-expense" data-date="${dateKey}">＋ Přidat výdaj</button>
          </div>
          ${expenses.length ? expenses.map(e => `<div class="expense"><div>${escapeHtml(e.description || "Výdaj")}</div><strong>${money(e.amount)}</strong></div>`).join("") : `<div class="muted">Žádné běžné výdaje.</div>`}
          <div style="margin-top:12px; font-weight:bold; font-size:16px;">Celkem útrata dne: ${money(expenseCost)}</div>
        </div>
      </div>
    `;
  }

  renderAddTrainBox() {
    return `
      <div class="add-train-box" style="display:none">
        <div class="muted">Vyber předvolbu vlaku:</div>
        <div class="train-options">
          <button type="button" class="train-option" data-action="add-preset" data-preset="morningEN">
            <strong>🌅 Ranní EN</strong><span>Bohumín → Praha</span>
          </button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="morningPendolino">
            <strong>🚄 Ranní Pendolino</strong><span>Bohumín → Praha</span>
          </button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="afternoonEx">
            <strong>🚆 Odpolední Ex</strong><span>Praha → Bohumín</span>
          </button>
          <button type="button" class="train-option" data-action="add-preset" data-preset="eveningPendolino">
            <strong>🌙 Večerní Pendolino</strong><span>Praha → Bohumín</span>
          </button>
        </div>
      </div>
    `;
  }

  renderTicket(ticket) {
    const cancelled = this.ticketManager.isCancelled(ticket);
    const status = this.ticketManager.getStatus(ticket);
    let statusHtml = "";

    if (cancelled) {
      statusHtml = `<span class="badge badge-cancelled">STORNOVÁNO</span>`;
    } else if (status === "done") {
      statusHtml = `<span class="badge badge-done">USKUTEČNĚNO</span>`;
    } else {
      statusHtml = `<span class="badge badge-planned">PLÁN</span>`;
    }

    return `
      <div class="ticket ${cancelled ? "cancelled" : ""}">
        <div class="ticket-head">
          <div>
            <div class="train-name">${escapeHtml(ticket.train)}</div>
            <div class="route">${escapeHtml(ticket.from)} → ${escapeHtml(ticket.to)}</div>
            <div class="time">${escapeHtml(ticket.dep)} → ${escapeHtml(ticket.arr)} (${ticket.km || 0} km)</div>
          </div>
          <div>${statusHtml}</div>
        </div>
        <div class="ticket-meta">
          ${ticket.car ? `Vůz ${escapeHtml(ticket.car)}` : ""}
          ${ticket.seat ? `· místo ${escapeHtml(ticket.seat)}` : ""}
          ${ticket.quiet ? `· 🔇 tichý oddíl` : ""}
        </div>
        <div class="ticket-actions">
          ${cancelled ? `
            <button type="button" class="btn btn-success btn-small" data-action="restore-ticket" data-id="${ticket.id}">↩ Obnovit jízdenku</button>
          ` : `
            <button type="button" class="btn btn-small" data-action="edit-ticket" data-id="${ticket.id}">✏️ Upravit</button>
            <button type="button" class="btn btn-danger btn-small" data-action="cancel-ticket" data-id="${ticket.id}">🚫 Stornovat</button>
          `}
        </div>
      </div>
    `;
  }
}

class CalendarRenderer {
  constructor(ticketManager, expenseManager, workPlanManager, onChange) {
    this.ticketManager = ticketManager;
    this.expenseManager = expenseManager;
    this.workPlanManager = workPlanManager;
    this.onChange = onChange;
  }

  render(year, month) {
    const monthName = new Date(year, month).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
    let html = `
      <div class="panel">
        <div class="calendar-header">
          <button data-action="prev-month">‹</button>
          <div class="calendar-title">${monthName}</div>
          <button data-action="next-month">›</button>
        </div>
        <div class="calendar-grid">
          <div class="calendar-weekday">Po</div>
          <div class="calendar-weekday">Út</div>
          <div class="calendar-weekday">St</div>
          <div class="calendar-weekday">Čt</div>
          <div class="calendar-weekday">Pá</div>
          <div class="calendar-weekday weekend">So</div>
          <div class="calendar-weekday weekend">Ne</div>
    `;

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    const days = daysInMonth(year, month);
    const currentKey = todayKey();

    for (let day = 1; day <= days; day++) {
      const key = keyFromDate(year, month, day);
      const dObj = new Date(key + "T12:00:00");
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      const tickets = this.ticketManager.getForDate(key);
      const validTickets = tickets.filter(t => this.ticketManager.isValid(t));
      const isPlanned = this.workPlanManager.isPlanned(key);
      const isToday = key === currentKey;
      const hasExpense = this.expenseManager.getForDate(key).length > 0;

      html += `
        <div class="calendar-day ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}" data-action="select-day" data-date="${key}">
          <div class="calendar-number">
            <span>${day}</span>
            <div class="day-indicators">
              ${isPlanned ? `<span class="dot dot-planned" title="Plán v Praze"></span>` : ""}
              ${validTickets.length ? `<span class="dot dot-done" title="Jízdenka"></span>` : ""}
              ${hasExpense ? `<span class="dot dot-warning" title="Výdaj"></span>` : ""}
            </div>
          </div>
          ${tickets.map(t => `
            <div class="calendar-ticket ${this.ticketManager.isCancelled(t) ? "cancelled" : this.ticketManager.getStatus(t)}">
              ${this.ticketManager.isCancelled(t) ? "× " : ""}${escapeHtml(t.train)}
            </div>
          `).join("")}
        </div>
      `;
    }

    html += `</div></div>`;
    return html;
  }
}

class StatsRenderer {
  constructor(statsCalculator) {
    this.statsCalculator = statsCalculator;
  }

  render() {
    const attendance = this.statsCalculator.getAttendance();
    const currentKey = todayKey();
    const monthKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const stats = this.statsCalculator.getMonthStats(monthKey);

    const taxiExp = stats.expenses.filter(e => (e.description || "").toLowerCase().includes("taxi"));
    const taxiTotal = taxiExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return `
      <div class="panel">
        <div class="panel-title">
          <div>
            <h2>📊 Celkové statistiky</h2>
            <div class="muted">Aktuální měsíc (k dnešnímu dni)</div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="big">${stats.ticketCount}</div>
            <div class="small">uskutečněné jízdy</div>
          </div>
          <div class="stat-card">
            <div class="big">${stats.totalKm} km</div>
            <div class="small">ujeto ve vlaku</div>
          </div>
          <div class="stat-card">
            <div class="big">${formatDuration(stats.totalMinutes)}</div>
            <div class="small">čas na kolejích</div>
          </div>
          <div class="stat-card">
            <div class="big">${money(stats.trainCost)}</div>
            <div class="small">za jízdenky</div>
          </div>
          <div class="stat-card">
            <div class="big">${money(stats.expenseCost)}</div>
            <div class="small">ostatní výdaje</div>
          </div>
          <div class="stat-card">
            <div class="big">${taxiExp.length}x (${money(taxiTotal)})</div>
            <div class="small">výdaje za taxi</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>🏢 Docházka do kanceláře</h3>
            <div class="muted">Podíl odpracovaných dnů z dosavadních pracovních dnů měsíce</div>
          </div>
        </div>
        <div style="font-size:28px;font-weight:bold">${(attendance ? 100 : 0).toFixed(1)} %</div>
        <div class="muted">${attendance} / ${attendance} proběhlých pracovních dnů</div>
        <div class="progress"><div style="width:100%"></div></div>
      </div>
    `;
  }
}
