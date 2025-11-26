- [x] **Baza Danych**: 
    - SQLite z pełną strukturą (NIP, daty, kwoty netto/vat/brutto).
    - Obsługa **Multi-Entity** (kolumna `entity` w każdej tabeli).
- [x] **Backend & AI**: 
    - Integracja z **Claude 4.5 Sonnet** (model `claude-sonnet-4-5-20250929`).
    - **Direct PDF Analysis**: Rezygnacja z lokalnego `pdf-parse`. Wysyłanie całego pliku PDF bezpośrednio do API Claude, co pozwala na lepsze zrozumienie struktury dokumentu (tabele, nagłówki).
    - Inteligentny fallback do wersji 3.5 w przypadku braku dostępu.
    - Ekstrakcja danych z PDF do ustrukturyzowanego JSON.


### Do Zrobienia (Zgodnie z Założenie.txt):
1.  **Logika Biznesowa**:
    - [x] **Parowanie (Matching)** płatności z fakturami - Zaimplementowane! System automatycznie paruje płatności z rozliczeń z fakturami na podstawie kwoty i kontrahenta/numeru faktury.
    - [ ] Obsługa "Paczek przelewów" (rozbijanie jednej płatności na wiele faktur).
    - [x] **Edycja danych faktury** przez użytkownika - Dodano modal edycji z pełną funkcjonalnością.
    - [x] **Usuwanie faktur** - Dodano endpoint DELETE z usuwaniem plików i wpisem do historii.
2.  **Baza Danych**:
    - [ ] Migracja na PostgreSQL (zalecana dla produkcji, obecnie SQLite dla dev).
3.  **Rozwój AI**:
    - [x] Dodanie obsługi obrazów (JPG/PNG) przez OCR - Claude 4.5 obsługuje bezpośrednio obrazy!
    - [ ] Uczenie modelu na podstawie korekt użytkownika (feedback loop).

## Uwagi Techniczne:
- **Model AI**: System domyślnie pyta o `claude-4-5-sonnet-20250929`.
- **UI**: Zastosowano podejście "Mobile First", ale zoptymalizowane pod duże ekrany ("Ultra Wide").
- **Bezpieczeństwo**: Klucze API przechowywane w `.env`.

## Historia Zmian:
- **v1.0**: Inicjalizacja projektu, podstawowy CRUD.
- **v1.1**: Dodanie AI (mock), podstawowy styl.
- **v1.2**: Wdrożenie prawdziwego Claude 3.5, obsługa Multi-Entity.
- **v1.3**: Aktualizacja do **Claude 4.5 Sonnet**, nowy layout "Ultra Wide Luxury", powiększenie interfejsu.
- **v1.4** (25.11.2024): 
    - ✅ Naprawiono błąd rozliczenia (`payments.reduce is not a function`)
    - ✅ Dodano endpointy DELETE i PUT dla faktur
    - ✅ System parowania płatności działa poprawnie
    - ✅ Edycja i usuwanie faktur w pełni funkcjonalne
- **v1.5** (25.11.2024 - UI & Integrity Update):
    - 🎨 **UI Refresh "Gold & Finesse"**: Nowy, elegancki styl dla list faktur, rozliczeń i historii (gradienty, złote akcenty).
    - 🧹 **History Cleanup**: Dodano możliwość czyszczenia całej historii zdarzeń.
    - 🛡️ **Self-Healing Settlements**: Automatyczna naprawa spójności danych przy usuwaniu faktur (odparowywanie płatności).
    - 🔄 **Reverse Matching**: Nowe faktury są automatycznie parowane z istniejącymi, niesparowanymi płatnościami.
    - 🔧 **Backend Fixes**: Naprawa endpointów, wymuszenie portu 5173, stabilizacja serwera.
