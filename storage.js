// ===== STORAGE & DATA MANAGEMENT =====

const STORAGE_KEY = "muj_pracovni_den_v8";

class AppData {
  constructor() {
    this.tickets = [];
    this.ticketStatusOverrides = {};
    this.workPlans = {};
    this.expenses = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.tickets)) this.tickets = data.tickets;
      if (data.ticketStatusOverrides) this.ticketStatusOverrides = data.ticketStatusOverrides;
      if (data.workPlans) this.workPlans = data.workPlans;
      if (Array.isArray(data.expenses)) this.expenses = data.expenses;
    } catch (error) {
      console.error("Chyba načítání dat:", error);
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tickets: this.tickets,
      ticketStatusOverrides: this.ticketStatusOverrides,
      workPlans: this.workPlans,
      expenses: this.expenses
    }));
  }

  export() {
    return {
      version: 8,
      exportedAt: new Date().toISOString(),
      tickets: this.tickets,
      ticketStatusOverrides: this.ticketStatusOverrides,
      workPlans: this.workPlans,
      expenses: this.expenses
    };
  }

  import(data) {
    if (Array.isArray(data.tickets)) this.tickets = data.tickets;
    if (data.ticketStatusOverrides) this.ticketStatusOverrides = data.ticketStatusOverrides;
    if (data.workPlans) this.workPlans = data.workPlans;
    if (Array.isArray(data.expenses)) this.expenses = data.expenses;
    this.save();
  }
}

// ===== UTILITY FUNCTIONS =====

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateObj(key) {
  return new Date(key + "T12:00:00");
}

function fmtDate(key) {
  return dateObj(key).toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function money(value) {
  return new Intl.NumberFormat("cs-CZ").format(Math.round(value || 0)) + " Kč";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uid(prefix = "id") {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function keyFromDate(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function calculateTrainDuration(dep, arr) {
  if (!dep || !arr) return 0;
  const [dh, dm] = dep.split(":").map(Number);
  const [ah, am] = arr.split(":").map(Number);
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${m} min`;
}

// ===== TRAIN TEMPLATES =====

const TRAIN_TEMPLATES = {
  morningEN: { train: "EN", direction: "outbound", from: "Bohumín", to: "Praha hl.n.", dep: "05:00", arr: "08:30", price: 600, km: 375 },
  morningPendolino: { train: "SC Pendolino", direction: "outbound", from: "Bohumín", to: "Praha hl.n.", dep: "04:58", arr: "08:25", price: 560, km: 375 },
  afternoonEx: { train: "Ex", direction: "return", from: "Praha hl.n.", to: "Bohumín", dep: "16:00", arr: "19:30", price: 600, km: 375 },
  eveningPendolino: { train: "SC Pendolino", direction: "return", from: "Praha hl.n.", to: "Bohumín", dep: "18:00", arr: "21:25", price: 600, km: 375 }
};

// ===== BUSINESS LOGIC =====

class TicketManager {
  constructor(data) {
    this.data = data;
  }

  getStatus(ticket) {
    return this.data.ticketStatusOverrides[ticket.id] || ticket.status || "planned";
  }

  isCancelled(ticket) {
    return this.getStatus(ticket) === "cancelled";
  }

  isValid(ticket) {
    return !this.isCancelled(ticket);
  }

  setStatus(ticketId, status) {
    this.data.ticketStatusOverrides[ticketId] = status;
    this.data.save();
  }

  add(ticket) {
    this.data.tickets.push({ id: uid("ticket"), ...ticket, source: "manual" });
    this.data.save();
  }

  update(ticketId, updates) {
    const index = this.data.tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
      this.data.tickets[index] = { ...this.data.tickets[index], ...updates };
      this.data.save();
    }
  }

  getForDate(dateKey) {
    return this.data.tickets
      .filter(t => t.date === dateKey)
      .sort((a, b) => (a.dep || "").localeCompare(b.dep || ""));
  }

  cancel(ticketId) {
    const ticket = this.data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    if (!confirm(`Opravdu chceš stornovat jízdenku ${ticket.train}?`)) return;
    this.setStatus(ticketId, "cancelled");
    return true;
  }

  restore(ticketId) {
    delete this.data.ticketStatusOverrides[ticketId];
    this.data.save();
  }
}

class WorkPlanManager {
  constructor(data) {
    this.data = data;
  }

  set(dateKey, isPlanned) {
    if (isPlanned) {
      this.data.workPlans[dateKey] = true;
    } else {
      delete this.data.workPlans[dateKey];
    }
    this.data.save();
  }

  isPlanned(dateKey) {
    return !!this.data.workPlans[dateKey];
  }
}

class ExpenseManager {
  constructor(data) {
    this.data = data;
  }

  add(expense) {
    this.data.expenses.push({ id: uid("expense"), ...expense });
    this.data.save();
  }

  getForDate(dateKey) {
    return this.data.expenses.filter(e => e.date === dateKey);
  }

  getForMonth(monthKey) {
    const currentKey = todayKey();
    return this.data.expenses.filter(e => e.date.startsWith(monthKey) && e.date <= currentKey);
  }
}

class StatsCalculator {
  constructor(ticketManager, expenseManager) {
    this.ticketManager = ticketManager;
    this.expenseManager = expenseManager;
  }

  getAttendance() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    let workdays = 0;
    for (let day = 1; day <= today; day++) {
      const d = new Date(year, month, day);
      const weekday = d.getDay();
      if (weekday !== 0 && weekday !== 6) {
        workdays++;
      }
    }
    return workdays;
  }

  getMonthStats(monthKey) {
    const currentKey = todayKey();
    const tickets = this.ticketManager.data.tickets
      .filter(t => t.date.startsWith(monthKey) && t.date <= currentKey && this.ticketManager.isValid(t));
    const expenses = this.expenseManager.getForMonth(monthKey);

    const totalKm = tickets.reduce((sum, t) => sum + Number(t.km || 375), 0);
    const totalMinutes = tickets.reduce((sum, t) => sum + calculateTrainDuration(t.dep, t.arr), 0);
    const trainCost = tickets.reduce((sum, t) => sum + Number(t.price || 0), 0);
    const expenseCost = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      ticketCount: tickets.length,
      totalKm,
      totalMinutes,
      trainCost,
      expenseCost,
      expenses
    };
  }
}
