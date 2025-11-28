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
- **v1.6** (26.11.2024 - Deployment & Cloud):
    - 🚀 **GitHub Integration**: Pełna synchronizacja kodu z repozytorium `GitAIMan/Hotel_Z-oty`.
    - ☁️ **Railway Deployment**: Aplikacja wdrożona na produkcję (Frontend + Backend).
    - 🔧 **Config Fixes**: Dynamiczne porty (`process.env.PORT`), zmienne środowiskowe dla API (`VITE_API_URL`), naprawa CORS.
    - 🛡️ **Security**: Klucze API przeniesione do bezpiecznych zmiennych środowiskowych Railway.
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
- **v1.6** (26.11.2024 - Deployment & Cloud):
    - 🚀 **GitHub Integration**: Pełna synchronizacja kodu z repozytorium `GitAIMan/Hotel_Z-oty`.
    - ☁️ **Railway Deployment**: Aplikacja wdrożona na produkcję (Frontend + Backend).
    - 🔧 **Config Fixes**: Dynamiczne porty (`process.env.PORT`), zmienne środowiskowe dla API (`VITE_API_URL`), naprawa CORS.
    - 🛡️ **Security**: Klucze API przeniesione do bezpiecznych zmiennych środowiskowych Railway.
- **v1.7** (27.11.2024 - Features & Fixes):
    - 📊 **CSV Settlements**: Obsługa plików Excel/CSV w rozliczeniach. Automatyczne mapowanie kolumn (Magazyn -> Kategoria, Brutto -> Kwota) i aktualizacja kategorii faktur w bazie.
    - 📱 **Mobile Photo**: Dedykowany moduł "Zrób Zdjęcie" na telefony (Drawer). Możliwość zrobienia do 3 zdjęć (Przód/Tył/Aparat) i wysłania ich zbiorczo.
    - 🛡️ **PDF Limits**: Blokada wgrywania plików PDF powyżej 3 stron (walidacja w przeglądarce).
    - 🔧 **PDF Worker Fix**: Naprawa błędu 404 na produkcji poprzez lokalne wbudowanie `pdf.worker.min.js` (Vite asset bundling).
    - 🧹 **VS Code Config**: Ukrycie ostrzeżeń Tailwind CSS w edytorze.
- **v1.8** (28.11.2024 - Railway Production Fixes):
    - 🚀 **Build Pipeline**: Naprawiono konfigurację `package.json` - dodano `postinstall` i prawidłowy `build` dla Railway.
    - 📦 **Static Serving**: Backend teraz serwuje zbudowany frontend (`client/dist`) - dodano middleware `express.static` i catch-all route dla SPA.
    - 🔌 **Server Startup**: Usunięto duplikat `app.listen()`, który powodował błąd `EADDRINUSE`.
    - 🌐 **API URLs**: Zmieniono frontend z hardcoded `localhost:3001` na relative `/api` + dodano Vite proxy dla dev.
    - 📄 **Settlement Route**: Dodano brakujący endpoint `POST /api/settlements/analyze`.
    - ✅ **Response Structure**: Naprawiono niezgodność Frontend/Backend - zmieniono `aiData` na `analysis` w odpowiedzi settlements.
    - 📊 **CSV Support**: Dodano pełną obsługę plików CSV/TXT w rozliczeniach - pliki są czytane jako tekst i wysyłane do Claude jako text blocks.
- **v1.9** (28.11.2024 - PostgreSQL Migration):
    - 🐘 **PostgreSQL Migration**: Pełna migracja z SQLite na Railway Managed PostgreSQL.
    - 🔄 **Dual-Mode Support**: Backend automatycznie wykrywa środowisko - Postgres (produkcja z DATABASE_URL) lub SQLite (local dev).
    - 🔒 **SSL Configuration**: Dodano SSL support dla Railway Postgres z self-signed certificates.
    - 📦 **Dependencies**: Dodano `pg` (^8.11.3) i `pg-hstore` (^2.3.4) dla PostgreSQL driver.
    - 🔧 **Migration Script**: Stworzono `server/scripts/migrate_data.js` do jednorazowej migracji danych z SQLite do Postgres z pełną weryfikacją.
    - 📝 **Documentation**: Dodano `RAILWAY_SETUP.md` z instrukcjami konfiguracji i `server/scripts/README.md` dla skryptu migracji.
    - ✅ **Data Persistence**: Dane są teraz trwale przechowywane w zarządzanej bazie Railway (nie giną przy redeploy).
