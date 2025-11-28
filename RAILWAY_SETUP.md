# Instrukcje Konfiguracji Railway dla PostgreSQL

## Krok 1: Dodaj Zmienną DATABASE_URL do Backend Service

1. Otwórz projekt **Hotel_Z-oty** w Railway Dashboard
2. Kliknij na kafelek **Server** (Backend)
3. Przejdź do zakładki **Variables**
4. Kliknij przycisk **New Variable** lub **Add Reference**
5. Jeśli widzisz opcję **Reference**, wybierz:
   - Service: **Postgres**
   - Variable: **DATABASE_URL**
6. Jeśli nie ma opcji Reference, kliknij na kafelek **Postgres**, skopiuj wartość `DATABASE_URL` i wklej ją ręcznie jako nową zmienną w Backend

## Krok 2: Redeploy Backend

Railway automatycznie przebuduje i zdeployuje backend po dodaniu zmiennej.

Sprawdź w Logs czy widzisz:
```
🐘 Connecting to PostgreSQL...
✅ Connected to PostgreSQL successfully!
✅ Database synced successfully (Schema updated).
```

## Krok 3: Migracja Danych (Lokalna)

**WAŻNE:** Uruchom to PRZED deployem lub ZARAZ PO pierwszym deployu.

1. W pliku `server/.env` dodaj:
   ```
   DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway
   ```
   (skopiuj wartość z Railway Postgres Variables)

2. Uruchom skrypt migracji:
   ```bash
   cd server
   node scripts/migrate_data.js
   ```

3. Sprawdź output - powinien pokazać ile rekordów zostało zmigrowanych:
   ```
   📊 Migration Summary:
     Invoices: 25 → 25 ✅
     Settlements: 5 → 5 ✅
     History: 150 → 150 ✅
   ```

## Krok 4: Weryfikacja

1. Otwórz aplikację na Railway
2. Sprawdź listę faktur - wszystkie powinny być widoczne
3. Dodaj nową fakturę - powinna zapisać się do Postgres
4. Sprawdź historię operacji

## Troubleshooting

### Backend nie łączy się z Postgres
- Sprawdź czy `DATABASE_URL` jest poprawnie ustawiona w Railway Variables
- Sprawdź Deployment Logs w Railway - powinien być komunikat `🐘 Connecting to PostgreSQL...`

### Dane się nie migrują
- Upewnij się że uruchomiłeś skrypt migracji z prawidłowym `DATABASE_URL` w `.env`
- Sprawdź czy plik `database.sqlite` istnieje i zawiera dane

### Duplikowane dane
- Nie uruchamiaj skryptu migracji dwa razy
- Jeśli to zrobiłeś, możesz wyczyścić tabele w Railway Postgres Query editor
