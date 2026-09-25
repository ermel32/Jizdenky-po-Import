// ===== ČD GOOGLE TAKEOUT IMPORT =====
// Zpracování ZIP exportu z Gmailu (Google Takeout) obsahujícího ČD e-maily.

class CDTakeoutImporter {
  constructor(app) {
    this.app = app;
    this.postalMimePromise = null;
  }

  async loadPostalMime() {
    if (!this.postalMimePromise) {
      this.postalMimePromise = import("https://cdn.jsdelivr.net/npm/postal-mime@3.0.0/+esm")
        .then(mod => mod.default || mod.PostalMime || mod);
    }
    return this.postalMimePromise;
  }

  async importZip(file) {
    if (!window.JSZip) throw new Error("Knihovna pro ZIP není načtená.");

    const PostalMime = await this.loadPostalMime();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const mboxEntries = Object.values(zip.files).filter(entry =>
      !entry.dir && /\.mbox$/i.test(entry.name)
    );

    if (!mboxEntries.length) {
      throw new Error("V ZIPu nebyl nalezen Gmail MBOX soubor.");
    }

    let purchases = [];
    let cancellations = new Set();
    let messageCount = 0;
    let purchaseCount = 0;
    let cancellationCount = 0;
    let errors = [];

    for (const entry of mboxEntries) {
      const bytes = await entry.async("uint8array");
      const raw = new TextDecoder("utf-8").decode(bytes);
      const messages = this.splitMbox(raw);
      messageCount += messages.length;

      for (let i = 0; i < messages.length; i++) {
        try {
          const email = await PostalMime.parse(new TextEncoder().encode(messages[i]));
          const subject = String(email.subject || "").trim();
          const body = String(email.text || email.html || "");

          if (this.isCancellation(subject, body)) {
            const doklad = this.extractDoklad(subject + "\n" + body);
            if (doklad) {
              cancellations.add(doklad);
              cancellationCount++;
            }
            continue;
          }

          if (!this.isPurchase(subject)) continue;

          purchaseCount++;
          const parsed = await this.parsePurchase(email, body);
          if (!parsed.doklad) {
            throw new Error("Nepodařilo se najít číslo dokladu.");
          }
          purchases.push(parsed);
        } catch (err) {
          errors.push(`Zpráva ${i + 1}: ${err.message || err}`);
        }
      }
    }

    // Stejný doklad se může v exportu objevit vícekrát.
    const unique = new Map();
    for (const ticket of purchases) {
      if (!unique.has(ticket.doklad)) unique.set(ticket.doklad, ticket);
    }

    const active = [...unique.values()].filter(t => !cancellations.has(t.doklad));
    const cancelled = [...unique.values()].filter(t => cancellations.has(t.doklad));

    // Výchozí klasifikace: první jízdenka v každém směru daného dne je hlavní,
    // další jízdenky stejného směru jsou pojistné. Ruční klasifikace se při
    // dalších importech zachová.
    const byDayDirection = new Map();
    for (const ticket of active) {
      const key = `${ticket.date}|${ticket.direction}`;
      if (!byDayDirection.has(key)) byDayDirection.set(key, []);
      byDayDirection.get(key).push(ticket);
    }
    for (const list of byDayDirection.values()) {
      list.sort((a, b) => (a.dep || "").localeCompare(b.dep || ""));
      list.forEach((ticket, index) => { ticket.ticketType = index === 0 ? "main" : "partial"; });
    }

    const result = this.saveActiveTickets(active, cancellations);

    return {
      messageCount,
      purchaseCount,
      cancellationCount,
      uniquePurchaseCount: unique.size,
      activeCount: active.length,
      cancelledCount: cancelled.length,
      unmatchedCancellationCount: [...cancellations].filter(d => !unique.has(d)).length,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      alreadyCount: result.alreadyCount,
      errors
    };
  }

  splitMbox(raw) {
    // MBOX odděluje zprávy řádkem začínajícím "From ". Citlivé řádky
    // v těle jsou v MBOXu standardně escapované jako ">From ".
    const parts = raw.split(/^From [^\r\n]*(?:\r\n|\n|\r)/m);
    return parts.slice(1).filter(Boolean);
  }

  isPurchase(subject) {
    const s = subject.toLowerCase();
    return s.includes("www.cd.cz") && s.includes("informace o objednávce");
  }

  isCancellation(subject, body) {
    const s = (subject + "\n" + body).toLowerCase();
    return s.includes("uplatnění práva z přepravní smlouvy") ||
           s.includes("uplatneni prava z prepravni smlouvy");
  }

  extractDoklad(text) {
    const normalized = String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ");

    const labelled = normalized.match(
      /(?:Doklad\s*číslo|Document\s*no\.?|doklad)\s*[:#-]?\s*\*?\s*(\d{2}\s*-\s*\d{4}\s*-\s*\d{3})/i
    );
    if (labelled) return labelled[1].replace(/\s+/g, "");

    const m = normalized.match(/\*?\b(\d{2}\s*-\s*\d{4}\s*-\s*\d{3})\b/);
    return m ? m[1].replace(/\s+/g, "") : "";
  }


  async parsePurchase(email, body) {
    const attachments = email.attachments || [];
    const pdf = attachments.find(a =>
      /\.pdf$/i.test(a.filename || "") ||
      /application\/pdf/i.test(a.mimeType || a.contentType || a.type || "")
    );
    const ics = attachments.find(a =>
      /\.ics$/i.test(a.filename || "") ||
      /text\/calendar/i.test(a.mimeType || a.contentType || a.type || "")
    );

    let pdfText = "";
    if (pdf) pdfText = await this.extractPdfText(pdf.content);

    const doklad = this.extractDoklad(pdfText);
    if (!doklad) {
      throw new Error(
        "PDF jízdenky neobsahuje rozpoznatelné číslo dokladu" +
        (pdf?.filename ? ` (${pdf.filename})` : "") +
        "."
      );
    }

    const ticket = {
      doklad,
      source: "cd-takeout",
      status: "planned",
      direction: "outbound",
      price: 0,
      km: 375,
      quiet: this.detectQuiet(pdfText),
      ticketType: "main"
    };

    Object.assign(ticket, this.parseIcs(ics ? this.decodeBytes(ics.content) : ""));
    Object.assign(ticket, this.parsePdfFallback(pdfText));

    ticket.train = normalizeTrainName(ticket.train);
    ticket.quiet = this.detectQuiet(pdfText);

    ticket.direction = String(ticket.from || "").toLowerCase().includes("praha") ? "return" : "outbound";
    ticket.price = getFixedTrainPrice(ticket);
    ticket.status = ticket.date && ticket.date < todayKey() ? "done" : "planned";

    if (!ticket.date || !ticket.train || !ticket.from || !ticket.to || !ticket.dep || !ticket.arr) {
      throw new Error(`Doklad ${doklad}: chybí datum, trasa nebo čas.`);
    }

    // Číslo dokladu je hlavní stabilní identifikátor. Objednávku a transakci
    // ukládáme jen jako doplňující údaje pro případnou diagnostiku.
    ticket.order = this.extractOrder(body);
    ticket.transaction = this.extractTransaction(body);
    return ticket;
  }

  decodeBytes(content) {
    if (typeof content === "string") return content;
    if (content instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(content));
    return new TextDecoder("utf-8").decode(content instanceof Uint8Array ? content : new Uint8Array(content));
  }

  async extractPdfText(content) {
    let bytes;
    if (content instanceof Uint8Array) {
      bytes = content;
    } else if (content instanceof ArrayBuffer) {
      bytes = new Uint8Array(content);
    } else if (content && content.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(content.buffer, content.byteOffset || 0, content.byteLength);
    } else if (typeof Blob !== "undefined" && content instanceof Blob) {
      bytes = new Uint8Array(await content.arrayBuffer());
    } else {
      throw new Error("Neznámý formát obsahu PDF přílohy.");
    }

    if (!bytes.length) throw new Error("PDF příloha je prázdná.");

    const read = async (disableWorker) => {
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        disableWorker: !!disableWorker,
        useWorkerFetch: false,
        isEvalSupported: false
      });
      const pdfDoc = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        fullText += textContent.items
          .map(item => String(item.str || ""))
          .filter(Boolean)
          .join(" ") + "\n";
      }

      try { await pdfDoc.destroy(); } catch (_) {}
      return fullText;
    };

    try {
      return await read(false);
    } catch (workerError) {
      try {
        return await read(true);
      } catch (directError) {
        throw new Error(
          "PDF se nepodařilo přečíst: " +
          (directError?.message || workerError?.message || "neznámá chyba")
        );
      }
    }
  }

  parseIcs(text) {
    if (!text) return {};
    const clean = text.replace(/\\n/g, "\n").replace(/\r/g, "");
    const lines = clean.split("\n");
    const get = prefix => {
      const line = lines.find(l => l.startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : "";
    };

    const dtstart = (clean.match(/DTSTART(?:;[^:]+)?:([0-9]{8})T([0-9]{4,6})/) || []);
    const dtend = (clean.match(/DTEND(?:;[^:]+)?:([0-9]{8})T([0-9]{4,6})/) || []);
    const summary = get("SUMMARY:");
    const description = get("DESCRIPTION:").replace(/\\,/g, ",");

    const result = {};
    if (dtstart[1]) result.date = `${dtstart[1].slice(0,4)}-${dtstart[1].slice(4,6)}-${dtstart[1].slice(6,8)}`;
    if (dtstart[2]) result.dep = `${dtstart[2].slice(0,2)}:${dtstart[2].slice(2,4)}`;
    if (dtend[2]) result.arr = `${dtend[2].slice(0,2)}:${dtend[2].slice(2,4)}`;

    // DESCRIPTION bývá např. "SC 516 / Bohumín 04:58 / Praha hl.n. 08:28 / vůz 1, místo 31".
    const d = description.match(/^\s*(.*?)\s*\/\s*(.*?)\s+(\d{1,2}:\d{2})\s*\/\s*(.*?)\s+(\d{1,2}:\d{2})\s*\/\s*vůz\s*([^,]+),\s*místo\s*(.+?)\s*$/i);
    if (d) {
      result.train = d[1].trim();
      result.from = d[2].trim();
      result.dep = d[3];
      result.to = d[4].trim();
      result.arr = d[5];
      result.car = d[6].trim();
      result.seat = d[7].trim();
    } else {
      const route = summary.match(/Cesta z\s+(.+?)\s+do\s+(.+)$/i);
      if (route) {
        result.from = route[1].trim();
        result.to = route[2].trim();
      }
    }

    if (result.train) result.train = result.train.replace(/\s+/g, " ");
    return result;
  }

  detectQuiet(text) {
    const clean = String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return /tiche\s+kupe|tichy\s+oddil|tiche\s+oddil|quiet\s+(?:compartment|coach|zone)|silent\s+(?:compartment|coach|zone)/i.test(clean);
  }

  parsePdfFallback(text) {
    const result = {};
    const clean = text.replace(/\s+/g, " ");

    // Záloha pro případ, že by v budoucím exportu chyběl ICS.
    const train = clean.match(/\b((?:SC|EC|IC|EN|Ex|RJ)\s*\d{2,4})\b/);
    if (train) result.train = train[1].replace(/\s+/g, " ");

    const date = clean.match(/(?:První den platnosti|First day of validity)\s*:?\s*(\d{2})[./](\d{2})[./](\d{4})/i) ||
                 clean.match(/\b(\d{2})[./](\d{2})[./](\d{4})\b/);
    if (date) result.date = `${date[3]}-${date[2]}-${date[1]}`;

    return result;
  }

  extractPrice(body) {
    const m = String(body).match(/Cena\s*:?\s*([0-9\s.,]+)\s*Kč/i);
    if (!m) return 0;
    return Number(m[1].replace(/\s/g, "").replace(".", "").replace(",", ".")) || 0;
  }

  extractOrder(body) {
    const m = String(body).match(/Objednávka\s*(?:č\.?|číslo)\s*[:.]?\s*([0-9 ]{8,})/i);
    return m ? m[1].trim() : "";
  }

  extractTransaction(body) {
    const m = String(body).match(/K[oó]d transakce\s*:?\s*([A-Z0-9]+)/i);
    return m ? m[1].trim() : "";
  }

  saveActiveTickets(active, cancellations) {
    let addedCount = 0;
    let updatedCount = 0;
    let alreadyCount = 0;
    let removedManualCancelledCount = 0;

    // ČD jízdenky, které mají v novém exportu skutečné storno, odstraníme.
    this.app.data.tickets = this.app.data.tickets.filter(ticket =>
      !(ticket.source === "cd-takeout" && ticket.doklad && cancellations.has(ticket.doklad))
    );

    // Pokud uživatel jízdenku ručně stornoval, při dalším Gmail importu ji
    // podle dokladu odstraníme také. Nový import ji tedy neobnoví.
    const manualCancelledDocs = new Set();
    for (const ticket of this.app.data.tickets) {
      if (ticket.source === "cd-takeout" && ticket.doklad && this.app.ticketManager.isCancelled(ticket)) {
        manualCancelledDocs.add(ticket.doklad);
      }
    }

    if (manualCancelledDocs.size) {
      const before = this.app.data.tickets.length;
      this.app.data.tickets = this.app.data.tickets.filter(ticket =>
        !(ticket.source === "cd-takeout" && ticket.doklad && manualCancelledDocs.has(ticket.doklad) && [...active].some(t => t.doklad === ticket.doklad))
      );
      removedManualCancelledCount = before - this.app.data.tickets.length;
    }

    for (const id of Object.keys(this.app.data.ticketStatusOverrides)) {
      const exists = this.app.data.tickets.some(t => t.id === id);
      if (!exists) delete this.app.data.ticketStatusOverrides[id];
    }

    for (const ticket of active) {
      const existing = this.app.data.tickets.find(t => t.source === "cd-takeout" && t.doklad === ticket.doklad);
      if (existing) {
        const oldType = existing.ticketType || "main";
        const wasSame = ["date","train","from","to","dep","arr","car","seat","quiet"].every(k => String(existing[k] ?? "") === String(ticket[k] ?? ""));
        Object.assign(existing, ticket, { id: existing.id, source: "cd-takeout", ticketType: oldType });
        if (wasSame) alreadyCount++;
        else updatedCount++;
      } else {
        this.app.data.tickets.push({ id: uid("ticket"), ...ticket, source: "cd-takeout", ticketType: ticket.ticketType || "main" });
        addedCount++;
      }
    }

    this.app.data.save();
    return { addedCount, updatedCount: updatedCount + removedManualCancelledCount, alreadyCount, removedManualCancelledCount };
  }
}
