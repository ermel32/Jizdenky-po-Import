ETAPA A – OPRAVA 4 – TEST

Tato verze vychází z Etapy A Oprava 2 a opravuje dvě věci:

1. ČD Google Takeout:
   - správné čtení DESCRIPTION z ICS s escaped \n
2. Ruční storno ČD:
   - pokud uživatel ručně stornuje jízdenku a později znovu importuje stejný Gmail/Takeout export,
     jízdenka se podle čísla dokladu znovu nepřidá; zůstane stornovaná.

Obsahuje také předchozí změny Etapy A:
- hlavní/pojistné jízdenky
- hlavní jízdenky ve statistikách, pojistné mimo statistiky
- pevné ceny vlaků
- SC 516 -> SC Pendolino
- tichý oddíl 🤫
- stručný kalendář
- skutečná Praha 🔵✓, HO 🏠, dovolená 🏖️
- Lítačka a ČSAD jako souhrnné výdaje
- zachování ručních změn typu jízdenky


Oprava 4 před nahráním do GitHubu: 
- skutečná Praha = pouze modrá ✓; plánované dny nemají falešnou fajfku/kolečko
- HO a dovolená zvýrazňují celý den
- HO plán = 20 % všech pracovních dnů vybraného měsíce
- rychlé výdaje: pouze 1× Lítačka (36 Kč) a 1× ČSAD (20 Kč)
- zachovány původní rychlé částky pro kávu, oběd a pivo
- robustnější rozpoznání tichého oddílu z ČD PDF
