// ===== MAIN APPLICATION =====

class App {
  constructor() {
    this.data = new AppData();
    this.ticketManager = new TicketManager(this.data);
    this.workPlanManager = new WorkPlanManager(this.data);
    this.expenseManager = new ExpenseManager(this.data);
    this.statsCalc = new StatsCalculator(this.ticketManager, this.expenseManager);

    this.dayRenderer = new DayDetailRenderer(this.ticketManager, this.expenseManager, this.workPlanManager);
    this.calendarRenderer = new CalendarRenderer(this.ticketManager, this.expenseManager, this.workPlanManager);
    this.statsRenderer = new StatsRenderer(this.statsCalc);

    this.currentView = "month";
    this.selectedDate = todayKey();
    this.calendarDate = new Date();
    this.pendingImportFile = null;
    this.cdImporter = new CDTakeoutImporter(this);

    this.setupPDF();
    this.setupEventListeners();
    this.render();
  }

  setupPDF() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  setupEventListeners() {
    // NAV
    document.querySelectorAll(".nav button").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const view = e.target.dataset.view;
        if (view) this.setView(view);
      });
    });

    // HEADER ACTIONS
    document.getElementById("btnExport").addEventListener("click", () => this.exportData());
    document.getElementById("btnImport").addEventListener("click", () => this.openImportModal());

    // MODALS - TICKET
    document.getElementById("ticketForm").addEventListener("submit", (e) => this.saveTicket(e));
    document.getElementById("btnCancelTicket").addEventListener("click", () => this.closeTicketModal());

    // MODALS - EXPENSE
    document.getElementById("expenseForm").addEventListener("submit", (e) => this.saveExpense(e));
    document.getElementById("btnCancelExpense").addEventListener("click", () => this.closeExpenseModal());
    document.querySelectorAll(".quick-expense-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const desc = e.target.dataset.desc;
        const amount = e.target.dataset.amount;
        document.getElementById("expenseDescription").value = desc;
        if (amount) document.getElementById("expenseAmount").value = amount;
      });
    });

    // MODALS - IMPORT
    document.getElementById("btnProcessImport").addEventListener("click", () => this.processImport());
    document.getElementById("btnCancelImport").addEventListener("click", () => this.closeImportModal());
    document.getElementById("importFileInput").addEventListener("change", (e) => this.handleFileImport(e));

    // MAIN CONTENT DELEGATION
    document.getElementById("app").addEventListener("click", (e) => this.handleMainClick(e));
  }

  handleMainClick(e) {
    const action = e.target.closest("[data-action]")?.dataset.action;
    const target = e.target.closest("[data-action]");

    if (!action) return;

    switch (action) {
      case "select-day":
        this.selectedDate = target.dataset.date;
        this.setView("today");
        break;
      case "prev-month":
        this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.render();
        break;
      case "next-month":
        this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.render();
        break;
      case "toggle-train-options":
        const box = target.closest(".day-section").querySelector(".add-train-box");
        if (box) box.style.display = box.style.display === "none" ? "block" : "none";
        break;
      case "add-preset":
        this.addPresetTrain(target.dataset.preset);
        break;
      case "open-expense":
        this.openExpenseModal(target.dataset.date);
        break;
      case "set-plan":
        this.workPlanManager.set(target.dataset.date, target.dataset.value === "1");
        this.render();
        break;
      case "edit-ticket":
        this.editTicket(target.dataset.id);
        break;
      case "cancel-ticket":
        if (this.ticketManager.cancel(target.dataset.id)) {
          this.render();
          setTimeout(() => {
            const ticket = this.ticketManager.data.tickets.find(t => t.id === target.dataset.id);
            if (ticket) this.setView("today");
          }, 50);
        }
        break;
      case "restore-ticket":
        this.ticketManager.restore(target.dataset.id);
        this.render();
        break;
    }
  }

  setView(view) {
    this.currentView = view;
    document.querySelectorAll(".nav button").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-view="${view}"]`)?.classList.add("active");
    this.render();
  }

  render() {
    const app = document.getElementById("app");
    if (this.currentView === "today") {
      app.innerHTML = this.dayRenderer.render(this.selectedDate);
    } else if (this.currentView === "month") {
      app.innerHTML = this.calendarRenderer.render(this.calendarDate.getFullYear(), this.calendarDate.getMonth());
      this.renderMonthStats();
    } else if (this.currentView === "stats") {
      app.innerHTML = this.statsRenderer.render();
    }
  }

  renderMonthStats() {
    const monthKey = `${this.calendarDate.getFullYear()}-${pad(this.calendarDate.getMonth() + 1)}`;
    const stats = this.statsCalc.getMonthStats(monthKey);
    const currentKey = todayKey();

    let monthExecutedCount = 0;
    let monthPlannedCount = 0;
    let monthTicketsCount = stats.ticketCount;
    let monthKm = stats.totalKm;
    let monthMinutes = stats.totalMinutes;
    let monthTrainCost = stats.trainCost;

    const days = daysInMonth(this.calendarDate.getFullYear(), this.calendarDate.getMonth());
    for (let day = 1; day <= days; day++) {
      const key = keyFromDate(this.calendarDate.getFullYear(), this.calendarDate.getMonth(), day);
      if (key <= currentKey) {
        if (this.workPlanManager.isPlanned(key)) monthPlannedCount++;
        const validTickets = this.ticketManager.getForDate(key).filter(t => this.ticketManager.isValid(t));
        if (validTickets.length > 0) monthExecutedCount++;
      }
    }

    const statsHtml = `
      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>📊 ${this.calendarDate.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })} – průběžný přehled</h3>
            <div class="muted">Statistiky počítané k dnešnímu dni</div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="big">${monthExecutedCount}</div>
            <div class="small">dny v Praze</div>
          </div>
          <div class="stat-card">
            <div class="big">${monthTicketsCount}</div>
            <div class="small">jízdy</div>
          </div>
          <div class="stat-card">
            <div class="big">${monthKm} km</div>
            <div class="small">ujetá vzdálenost</div>
          </div>
          <div class="stat-card">
            <div class="big">${formatDuration(monthMinutes)}</div>
            <div class="small">čas ve vlaku</div>
          </div>
          <div class="stat-card">
            <div class="big">${money(monthTrainCost)}</div>
            <div class="small">za jízdenky</div>
          </div>
          <div class="stat-card">
            <div class="big">${money(stats.expenseCost)}</div>
            <div class="small">ostatní výdaje</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("app").innerHTML += statsHtml;
  }

  // TICKET MODAL
  openTicketModal(ticket = null) {
    const modal = document.getElementById("ticketModal");
    document.getElementById("ticketForm").reset();
    document.getElementById("ticketModalTitle").textContent = ticket ? "Upravit vlak" : "Přidat vlak";
    document.getElementById("editTicketId").value = ticket?.id || "";
    document.getElementById("ticketDate").value = ticket?.date || this.selectedDate;
    document.getElementById("ticketStatus").value = ticket?.status || "planned";
    document.getElementById("ticketTrain").value = ticket?.train || "";
    document.getElementById("ticketDirection").value = ticket?.direction || "outbound";
    document.getElementById("ticketFrom").value = ticket?.from || "";
    document.getElementById("ticketTo").value = ticket?.to || "";
    document.getElementById("ticketDep").value = ticket?.dep || "";
    document.getElementById("ticketArr").value = ticket?.arr || "";
    document.getElementById("ticketCar").value = ticket?.car || "";
    document.getElementById("ticketSeat").value = ticket?.seat || "";
    document.getElementById("ticketPrice").value = ticket?.price ?? "";
    document.getElementById("ticketKm").value = ticket?.km ?? 375;
    document.getElementById("ticketQuiet").checked = !!ticket?.quiet;
    modal.classList.add("show");
  }

  closeTicketModal() {
    document.getElementById("ticketModal").classList.remove("show");
  }

  saveTicket(e) {
    e.preventDefault();
    const id = document.getElementById("editTicketId").value;
    const data = {
      date: document.getElementById("ticketDate").value,
      status: document.getElementById("ticketStatus").value,
      train: document.getElementById("ticketTrain").value.trim(),
      direction: document.getElementById("ticketDirection").value,
      from: document.getElementById("ticketFrom").value.trim(),
      to: document.getElementById("ticketTo").value.trim(),
      dep: document.getElementById("ticketDep").value,
      arr: document.getElementById("ticketArr").value,
      car: document.getElementById("ticketCar").value.trim(),
      seat: document.getElementById("ticketSeat").value.trim(),
      price: Number(document.getElementById("ticketPrice").value || 0),
      km: Number(document.getElementById("ticketKm").value || 375),
      quiet: document.getElementById("ticketQuiet").checked
    };

    if (id) {
      this.ticketManager.update(id, data);
    } else {
      this.ticketManager.add(data);
    }

    this.closeTicketModal();
    this.render();
    setTimeout(() => {
      this.selectedDate = data.date;
      this.setView("today");
    }, 50);
  }

  editTicket(id) {
    const ticket = this.ticketManager.data.tickets.find(t => t.id === id);
    if (ticket) this.openTicketModal(ticket);
  }

  addPresetTrain(presetKey) {
    const p = TRAIN_TEMPLATES[presetKey];
    if (!p) return;
    this.openTicketModal({ ...p, date: this.selectedDate, status: "planned", mode: "add" });
  }

  // EXPENSE MODAL
  openExpenseModal(dateKey) {
    document.getElementById("expenseDate").value = dateKey;
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseDescription").value = "";
    document.getElementById("expenseModal").classList.add("show");
  }

  closeExpenseModal() {
    document.getElementById("expenseModal").classList.remove("show");
  }

  saveExpense(e) {
    e.preventDefault();
    const dateKey = document.getElementById("expenseDate").value;
    this.expenseManager.add({
      date: dateKey,
      amount: Number(document.getElementById("expenseAmount").value || 0),
      description: document.getElementById("expenseDescription").value.trim()
    });
    this.closeExpenseModal();
    this.render();
    setTimeout(() => {
      this.selectedDate = dateKey;
      this.setView("today");
    }, 50);
  }

  // IMPORT MODAL
  openImportModal() {
    document.getElementById("importTextArea").value = "";
    document.getElementById("importFileInput").value = "";
    this.pendingImportFile = null;
    document.getElementById("universalImportModal").classList.add("show");
  }

  closeImportModal() {
    document.getElementById("universalImportModal").classList.remove("show");
  }

  async handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.pendingImportFile = file;

    if (file.name.toLowerCase().endsWith(".zip")) {
      document.getElementById("importTextArea").value =
        `Vybrán ČD Google Takeout ZIP: ${file.name}\n\nPo kliknutí na „Zpracovat a importovat“ aplikace ZIP sama rozbalí, projde ČD e-maily, spáruje storna a přidá pouze aktuální jízdenky.`;
      return;
    }

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById("importTextArea").value = e.target.result;
      };
      reader.readAsText(file);
      return;
    }

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          let lastY = null;
          let lineText = "";

          for (let item of textContent.items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
              fullText += lineText + "\n";
              lineText = "";
            }
            lineText += item.str + " ";
            lastY = item.transform[5];
          }
          fullText += lineText + "\n";
        }

        document.getElementById("importTextArea").value = fullText;
        alert("PDF soubor byl úspěšně přečten!");
      } catch (err) {
        console.error(err);
        alert("Nepodařilo se přečíst PDF soubor.");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("importTextArea").value = e.target.result;
    };
    reader.readAsText(file);
  }

  async processImport() {
    // ČD Google Takeout ZIP – zpracovává se přímo jako archiv, ne jako text.
    if (this.pendingImportFile && this.pendingImportFile.name.toLowerCase().endsWith(".zip")) {
      const btn = document.getElementById("btnProcessImport");
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Zpracovávám ČD ZIP…";

      try {
        const result = await this.cdImporter.importZip(this.pendingImportFile);
        this.render();
        this.closeImportModal();

        const errors = result.errors.length
          ? `\n\n⚠️ Chyby: ${result.errors.slice(0, 5).join(" | ")}${result.errors.length > 5 ? " …" : ""}`
          : "";

        alert(
          `ČD import dokončen.\n\n` +
          `E-mailů: ${result.messageCount}\n` +
          `Nákupních zpráv: ${result.purchaseCount}\n` +
          `Storen: ${result.cancellationCount}\n` +
          `Unikátních jízdenek: ${result.uniquePurchaseCount}\n` +
          `Aktuálně platných: ${result.activeCount}\n` +
          `Přidáno nových: ${result.addedCount}\n` +
          `Aktualizováno: ${result.updatedCount}\n` +
          `Již existovalo: ${result.alreadyCount}\n` +
          `Storno bez odpovídajícího nákupu: ${result.unmatchedCancellationCount}` +
          errors
        );
      } catch (err) {
        console.error("ČD import:", err);
        alert(`ČD ZIP se nepodařilo zpracovat.\n\n${err.message || err}`);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }

    const text = document.getElementById("importTextArea").value.trim();
    if (!text) {
      alert("Není zde žádný text k zpracování.");
      return;
    }

    try {
      if (text.startsWith("{") || text.startsWith("[")) {
        const data = JSON.parse(text);
        if (data.tickets && confirm("Import nahradí současná data. Pokračovat?")) {
          this.data.import(data);
          this.render();
          this.closeImportModal();
          alert("Záloha byla úspěšně obnovena.");
          return;
        }
      }

      // PARSE AIR BANK / PID
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      let addedCount = 0;
      let currentDate = null;

      const regexDatum = /^(\d{2})\.(\d{2})\.(\d{4})/;
      const regexCastka = /^(-?\d+(?:[,\.]\d{1,2})?)\s*(?:Kč|CZK)?$/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const dateMatch = line.match(regexDatum);
        if (dateMatch) {
          currentDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          continue;
        }

        const cleanLine = line.toLowerCase().replace(/\s+/g, "");
        const isLitacka = cleanLine.includes("pid") || cleanLine.includes("litacka");

        if (isLitacka && currentDate) {
          for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
            const amountMatch = lines[j].match(regexCastka);
            if (amountMatch) {
              let amount = parseFloat(amountMatch[1].replace(",", "."));
              if (amount < 0) amount = Math.abs(amount);
              if (amount > 0 && amount < 10000) {
                const exists = this.expenseManager.data.expenses.some(e =>
                  e.date === currentDate && e.amount === amount && e.description.includes("PID")
                );
                if (!exists) {
                  this.expenseManager.add({
                    date: currentDate,
                    amount: amount,
                    description: "PID Lítačka jízdné"
                  });
                  addedCount++;
                }
                break;
              }
            }
          }
        }
      }

      alert(`Úspěšně importováno ${addedCount} plateb PID Lítačky.`);
      this.render();
      this.closeImportModal();
    } catch (err) {
      console.error(err);
      alert("Chyba při zpracování importu.");
    }
  }

  exportData() {
    const blob = new Blob([JSON.stringify(this.data.export(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "muj-pracovni-den-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }
}

// START APP
const app = new App();
