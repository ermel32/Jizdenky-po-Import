# Můj pracovní den – Refaktorování

## 📋 Co se změnilo

Původní kód byl jeden obří HTML soubor (2000+ řádků). Teď je rozdělen do 5 souborů.

### Nová struktura:
- `index.html` – Jen HTML struktura, bez kódu
- `styles.css` – Všechny CSS styly
- `storage.js` – Správa dat a třídy `AppData`, `TicketManager`, atd.
- `components.js` – Generování UI (`DayDetailRenderer`, `CalendarRenderer`, atd.)
- `app.js` – Hlavní aplikační logika a event listenery

## 🗑️ Smazáno

- **NHL_GAMES** – Nikdy se nepoužívaly, zcela zbytečné
- Inline `setTimeout` po `openDayDetail` – Zbytečné zpoždění
- Hundreds of inline HTML strings in JavaScript – Teď jsou v metodách tříd

## ✨ Vylepšení

1. **Oddělení zájmů (Separation of Concerns)**
   - HTML = struktura
   - CSS = vzhled
   - JS = logika

2. **Třídy místo procedurální kód**
   ```javascript
   // Dřív: Spoustou globálních funkcí
   // Teď: AppData, TicketManager, WorkPlanManager...
   ```

3. **Event delegation**
   - Místo `onclick="..."` v HTML jsou data-atributy
   - Jeden listener na `#app` řídí všechny kliknutí

4. **Lepší organizace**
   - Logika = `storage.js`
   - UI komponenty = `components.js`
   - Aplikace = `app.js`

## 🚀 Jak používat

1. Otevři `index.html` v prohlížeči
2. Všechno funguje stejně jako dřív
3. Data se ukládají do `localStorage`

## 📚 Pro začátečníky

### Jak přidat novou funkci?

**Příklad: Chcete odstraňovat výdaje**

1. **HTML** (`index.html`) – Přidej button:
```html
<button type="button" data-action="delete-expense" data-id="...">Smazat</button>
```

2. **Logika** (`storage.js`) – Přidej metodu do `ExpenseManager`:
```javascript
delete(expenseId) {
  this.data.expenses = this.data.expenses.filter(e => e.id !== expenseId);
  this.data.save();
}
```

3. **Event handler** (`app.js`) – Přidej do `handleMainClick`:
```javascript
case "delete-expense":
  this.expenseManager.delete(target.dataset.id);
  this.render();
  break;
```

## 🔍 Struktura tříd

```
AppData
├── Ukládá do localStorage
└── import/export metody

TicketManager
├── Přidávání/úprava jízdenek
└── Správa statu (plán/realita/storno)

WorkPlanManager
├── Přidávání plánů do Prahy
└── Kontrola, zda je den naplánován

ExpenseManager
├── Přidávání výdajů
└── Filtrování dle data/měsíce

StatsCalculator
├── Počítání statistik
└── Kalkulace docházky/km/času

DayDetailRenderer
├── Vykreslí detail jednoho dne
└── HTML pro jízdenky a výdaje

CalendarRenderer
├── Vykreslí měsíční kalendář
└── Zobrazuje indikátory (plány/jízdy)

StatsRenderer
└── Vykreslí statistiky

App (hlavní třída)
├── Řídí všechny ostatní
├── Event listenery
└── Synchronizuje UI s daty
```

## 💡 Tipy pro úpravy

- Chceš změnit barvy? Jdi do `styles.css`, změň `:root` proměnné
- Chceš nový train template? Přidej do `TRAIN_TEMPLATES` v `storage.js`
- Chceš měnit formátování dat? Jsou utility funkce v `storage.js` (money, fmtDate, atd.)

## 🐛 Debugování

Otevři DevTools (F12) a zkus:
```javascript
// Vypíše všechna data
console.log(app.data);

// Vypíše všechny tickets
console.log(app.data.tickets);

// Smaž všechna data
localStorage.clear();
location.reload();
```

---

Gratuluji! Teď máš čistý, rozumný kód, který je jednodušší měnit a rozšiřovat. 🎉
