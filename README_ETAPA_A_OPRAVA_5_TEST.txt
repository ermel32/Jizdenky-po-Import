# Etapa A – Oprava 5 TEST

Tato verze navazuje na Opravu 4 a řeší finální logiku měsíčního kalendáře a statistik před testem.

- Praha skutečnost = pouze zvýraznění celé buňky, bez fajfky a bez oranžové tečky.
- Plánované vlaky se nepočítají do uskutečněných dnů ani měsíčních statistik.
- U ČD importu jsou na jeden den první dvě časově seřazené jízdenky hlavní, další jsou pojistné/částečné.
- Ručně změněný typ jízdenky se automatickou klasifikací nepřepíše.
- HO se počítá z pracovních dnů po odečtení dovolené a Sick Day.
- Přidán typ dne Sick Day a jeho zvýraznění.
- HO, dovolená a Sick Day zvýrazňují celý den.
- Lítačka a ČSAD mají jednu rychlou volbu; cenu lze ručně upravit.
- Tichý oddíl se dál načítá automaticky z ČD PDF.
- Ruční storno ČD jízdenky zůstává zachované při novém importu.

Důležité: testovat pouze na branchi `Test`. `main` neměnit.
