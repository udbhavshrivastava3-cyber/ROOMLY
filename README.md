# Roomly — Luxury Hotel Management System (MERN)

Roomly is a full-stack hotel management platform for university coursework demonstration: guest booking with a server-verified **demo payment simulation**, staff operations (check-in/out, housekeeping), hotel-manager inventory/pricing tools, and platform administration with aggregation-driven analytics and audit logs.

**India-focused build:** INR pricing across the UI, Indian GST room-rent slabs computed server-side (≤ ₹7,500/night → 0%, < ₹75,000 → 5%, ≥ ₹75,000 → 12%, configurable via `TAX_RATE_PCT`), DD MMM YYYY dates, optional +91 mobile registration, and three fictional demo properties in Jaipur, Goa and Kochi (`npm run seed:reset`).

**Verified with Node v24 / npm 11 / MongoDB 8.3.7 on a local Windows machine.** All 31 backend integration tests pass; the Vite production build succeeds; an end-to-end HTTP smoke test (booking → demo payment → confirmed → invoice PAID) runs green.

## Stack

- **Server:** Node + Express 4, Mongoose 8, JWT (HttpOnly cookie), Helmet, CORS allowlist, express-rate-limit, Nodemailer (dev fallback logging)
- **Client:** React 18 + Vite 5, Material UI 5, axios, Recharts, React Router 6
- **Database:** local MongoDB (Atlas-compatible via `MONGODB_URI`)
- **Payments:** `Roomly Demo Pay` — an explicitly labeled simulation; a real Stripe integration is future work (the demo path is separate from any gateway code)
- **Tests:** Mocha + Supertest against the real app + a throwaway local database

## Windows setup (PowerShell or CMD)

Prerequisites: Node.js ≥ 18, npm ≥ 9, Git, MongoDB Community Server **running as a service** (`netstat -ano | findstr 27017` should show a listener).

```powershell
cd Roomly
npm run install:all          # installs root + server + client deps

# configure environment (placeholders are fine for local dev)
copy server\.env.example server\.env
copy client\.env.example client\.env

# seed demo data (refuses to run if NODE_ENV=production)
npm run seed                 # or: npm run seed:reset to wipe reseed

npm run dev                  # starts API on :5000 and Vite UI on :5173
```

Open http://localhost:5173

## Demo accounts (development only, all password `RoomlyDemo123`)

| Role | Email |
|---|---|
| Guest | guest@roomly.demo |
| Staff | staff@roomly.demo |
| Hotel manager | manager@roomly.demo |
| Admin | admin@roomly.demo |

Roles are created via bcrypt-hashed records only — public registration always yields the `guest` role.

## Commands

```powershell
npm run dev        # both processes (concurrently)
npm run dev:server # API only, http://localhost:5000
npm run dev:client # UI only,  http://localhost:5173 (proxies /api to :5000)
npm run test:server   # mocha tests/*.test.js
npm run seed:reset
npm run client:build # production UI build (client/dist)
```

Notes:
- If `PORT` is already set in your environment (e.g. `PORT=0`), it overrides `.env` because dotenv does not override existing variables — unset it or set `PORT=5000`.
- MongoDB runtime is required for dev and tests; tests create a throwaway `roomly_test_tmp_*` database and drop it afterwards.

## Tests

```powershell
npm run test:server   # 31 passing (mocha tests/*.test.js)
```

Covers: auth (registration, hashing, no role self-assignment, uniform login errors, invalid sessions), booking engine (validation, overlap rejection, **concurrent double-booking prevented by a unique per-night index**, pricing snapshots), payments (server-side verification, failed transactions, idempotent duplicate confirm, no phantom success endpoint), cancellation & refund-request flow, check-in/out state machine, housekeeping, ownership/isolation between guests and hotels, admin permissions and audit logs.

## Key limitations (honest list)

1. **Payments are simulated.** `Roomly Demo Pay` moves no money and fabricates no gateway identifiers; a real gateway requires provider test credentials. Refunds are recorded as status changes only — nothing reaches any bank.
2. **Seasonal pricing is documented but not implemented** (`SeasonalRate` model deferred); base price applies uniformly and this is stated in the API response notes.
3. **Email** requires SMTP credentials; without them the mail service logs development messages and reports `sent:false`.
4. **Hotel creation is admin-only** through the API (no admin "create hotel" UI screen — see `POST /api/v1/manage/hotels`).
5. Concurrency safety relies on the unique `(room, night)` lock index rather than MongoDB transactions; a replica set is not required. Verified in tests.
6. Browser end-to-end (Playwright) tests were not run; HTTP-level e2e smoke coverage exists instead (`scripts/smoke.sh`).

See `docs/` for architecture, schema, API, security, testing notes and the demo guide.
