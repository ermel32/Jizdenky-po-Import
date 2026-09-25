ETAPA A – OPRAVA 2
Můj pracovní den – Praha

OBSAH
- index.html
- app.js
- storage.js
- components.js
- cd-import.js
- styles.css

HLAVNÍ ZMĚNY
1. ČD ceny jsou pevné:
   - EN 442 ráno: 600 Kč
   - ranní SC Pendolino: 600 Kč
   - IC 547: 500 Kč
   - večerní SC Pendolino: 450 Kč
2. Statistiky počítají pouze platné HLAVNÍ jízdenky.
   Pojistné/částečné jízdenky se do jízd, km, času ani ceny nepočítají.
3. SC 516 / SC 517 apod. se v UI zobrazují jako SC Pendolino.
   EN 442 / IC 547 zůstávají včetně čísla vlaku.
4. Při ČD ZIP importu se první jízdenka v každém směru daného dne výchozím způsobem označí jako HLAVNÍ a další jako POJISTNÁ.
   Pokud už uživatel klasifikaci ručně změnil, další import ji zachová.
5. Ručně stornovaná ČD jízdenka se při dalším Gmail importu podle čísla dokladu odstraní, pokud se v novém exportu podaří spárovat.
6. Tiché kupé se zkouší automaticky rozpoznat z PDF ČD a zobrazí se v detailu i kalendáři jako 🤫.
7. Lítačka má kategorii a ikonku 🚇. Denní přehled slučuje Lítačku do jednoho řádku a rozepisuje typy (30 min / 90 min / 24 h).
8. Ruční výdaj obsahuje možnost Lítačka:
   - 30 min: 36 Kč
   - 90 min: 46 Kč
   - 24 h: 140 Kč
9. Kalendář zobrazuje hlavní vlaky chronologicky: název + čas + případné 🤫. Další jízdenky jsou jako +N další.
10. Stav dne: 🔵✓ Praha, 🏠 HO, 🏖️ dovolená, plánovaná Praha bez realizace zůstává označena jinak.
11. V detailu dne lze jedním kliknutím označit HO nebo dovolenou.
12. HO statistika má výchozí plán 20 % pracovních dnů.

NASAZENÍ
- Rozbalit ZIP.
- Nahrát všechny soubory do větve Test.
- Potvrdit přepsání existujících souborů.
- Commitnout pouze do Test.
- main neměnit.
- Po deployi GitHub Pages udělat Ctrl+F5.

DOPORUČENÍ PŘED TESTEM
- Pokud máš důležitá data, nejdřív použij Export v aplikaci.
- Po nasazení nejprve zkontroluj existující září 2026.
- Potom otestuj nový ČD ZIP import.
