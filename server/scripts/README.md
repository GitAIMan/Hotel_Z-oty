# Migracja Danych z SQLite do PostgreSQL

Ten skrypt przenosi wszystkie dane z lokalnej bazy SQLite do Railway PostgreSQL.

## Instrukcja

### 1. Przygotowanie
Upewnij się, że masz:
- ✅ Zainstalowane dependencje (`npm install` w folderze `server`)
- ✅ Plik `.env` z `DATABASE_URL` (Railway Postgres connection string)

### 2. Uruchomienie Migracji

```bash
cd server
node scripts/migrate_data.js
```

### 3. Co robi skrypt?

1. Łączy się z SQLite (lokalna baza `database.sqlite`)
2. Łączy się z PostgreSQL (Railway - zmienna `DATABASE_URL`)
3. Tworzy tabele w PostgreSQL (jeśli nie istnieją)
4. Kopiuje wszystkie dane:
   - Invoices (faktury)
   - Settlements (rozliczenia)
   - Histories (historia operacji)
5. Weryfikuje że liczba rekordów się zgadza

### 4. Weryfikacja

Skrypt wyświetli podsumowanie:
```
📊 Migration Summary:
  Invoices: 25 → 25 ✅
  Settlements: 5 → 5 ✅
  History: 150 → 150 ✅
```

### 5. Po Migracji

- Dane są **skopiowane** (nie przeniesione) - oryginały pozostają w SQLite
- Możesz usunąć plik `database.sqlite` lub zachować jako backup
- Backend automatycznie użyje PostgreSQL gdy `DATABASE_URL` jest ustawiona

## Troubleshooting

### Błąd: "DATABASE_URL not set"
Ustaw zmienną w pliku `.env`:
```
DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway
```

### Błąd: "SSL required"
Skrypt już zawiera konfigurację SSL - jeśli problem występuje, sprawdź czy Railway Postgres jest dostępny.

### Błąd: "Duplicate key"
Jeśli uruchomisz skrypt dwa razy - niektóre rekordy mogą się duplikować. Użyj `{ force: true }` w `postgresDb.sync()` aby wyczyścić tabele przed migracją (UWAGA: usuwa dane!).
