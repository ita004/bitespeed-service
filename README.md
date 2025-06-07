# Bitespeed Identity Reconciliation Service

A microservice for **identity reconciliation**, linking customer contact records (email / phone) across multiple purchases into unified profiles.

Built with:

* **Node.js** & **TypeScript**
* **Express** for HTTP API
* **PostgreSQL** (raw SQL via `pg`)
* **Zod** for input validation
* **Pino** for structured logging

---

## Live Endpoint

> `POST https://https://bitespeed-service.onrender.com/identify`

## Tech Stack & Key Dependencies

* **pg**: PostgreSQL client
* **dotenv**: Environment variable loading
* **zod**: Schema-based validation
* **pino** & **pino-pretty**: Logging
* **ts-node-dev**: Local development server

---

## API Usage

### POST `/identify`

Consolidate a contact cluster by email and/or phone.

**Request Body** (JSON):

```json
{
  "email":       string | null,
  "phoneNumber": string | null
}
```

* At least one of `email` or `phoneNumber` is required.
* Empty strings or `null` values are treated as "not provided".

**Response** (200 OK):

```json
{
  "contact": {
    "primaryContactId": number,
    "emails":            string[],
    "phoneNumbers":      string[],
    "secondaryContactIds": number[]
  }
}
```

**Validation Errors** (400 Bad Request):

```json
{ "error": "<message>" }
```

---

## Local Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/<you>/bitespeed-backend.git
   cd bitespeed-backend
   ```
2. Install:

   ```bash
   npm install
   ```
3. Copy environment:

   ```bash
   cp .env.example .env
   ```
4. Configure `.env`:

   ```env
   DATABASE_URL=postgres://<user>:<pass>@localhost:5432/bitespeed
   PORT=3000
   ```
5. Create DB and schema:

   ```bash
   # start Postgres cluster if needed
   psql $DATABASE_URL -f migrations/001_create_contacts.sql
   ```
6. Run dev server:

   ```bash
   npm run dev
   ```

---

## Testing

```bash
npm test
```

Includes e2e tests for:

* Primary creation
* Secondary insertion by email/phone
* Idempotency
* Primary merge logic

---

## Transaction & Concurrency

All DB logic is wrapped in a single **serializable transaction** via `withTx`. Row-level locks and `WITH RECURSIVE` ensure safe, atomic merges without race conditions.

---

## Performance & Indexing

* Indexed on `email` & `phone_number`
* Parameterized queries prevent SQL injection.

---

## Security & Validation

* **Zod** schema enforces:

  * Valid email formats
  * Non-empty phone strings
  * At least one contact field
* All SQL uses prepared statements.

---

## Logging

* **Pino** provides structured logs.
* Verbosity control via `LOG_LEVEL` env (e.g. `debug` vs `info`).

---

## Logic Summary

1. **Find** existing contacts by email or phone.
2. **If none** found → create new primary.
3. **If found** → load full cluster, pick oldest as primary.
4. **Merge**: downgrade other primaries to secondaries.
5. **Insert** secondary if new info present.
6. **Return** consolidated cluster.

