# Habit Tracker with Streaks

Define habits, check in once a day, and see how long your current and longest
streaks are — counted in **your own local days**, never in elapsed hours.

The whole application turns on one rule: two check-ins twenty hours apart may be
the same day or two different days, and only the user's time zone decides which.

---

## How local days are modelled

This is the part of the design worth reading, so it comes first.

### A local day is a string, not a `Date`

A `Date` is an _instant_. `2026-03-12` is not an instant — it is a square on
somebody's calendar. Storing it as a timestamp means every layer in the stack
(the driver, the ORM, the JSON serialiser, the browser) gets another chance to
re-interpret it in some other zone and quietly shift it by a day.

So a local day is the string `YYYY-MM-DD`, and it never becomes a `Date` again.
Three things fall out of that choice for free:

- ISO date strings sort lexicographically in the same order they sort
  chronologically, so plain string sorting is date sorting.
- Day arithmetic is unaffected by daylight saving. A DST day is 23 or 25 hours
  long, but it is still exactly one day, because a calendar square has no hours.
- The value that leaves the database is the value that was written.

### The conversion happens once, at the edge

`src/lib/local-day.ts` is the only file in the codebase that knows time zones
exist. It converts a UTC instant into a calendar day and then gets out of the
way:

```
UTC instant + IANA zone
  ↓  toLocalDay()          ← the only conversion in the app
"2026-03-12"  (a LocalDay)
  ↓  computeStreaks()      ← pure calendar arithmetic, no zones involved
{ currentStreak, longestStreak }
```

Everything downstream — validation, streak maths, the API, the UI — receives a
`LocalDay` and never touches an offset again. That is what makes the logic
testable without a database, a clock, or a running server.

### What each column is for

A check-in stores **both** facts, because they are genuinely different:

| Column        | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `checkedInAt` | The exact UTC instant the row was written. Audit trail.         |
| `localDay`    | The calendar square it counts for. The streak maths reads this. |

For a check-in made right now the two agree. For a **backfilled** check-in they
do not: `localDay` is a past date while `checkedInAt` is now. Keeping both is
what makes backfilling honest rather than a rewrite of history.

### One check-in per habit per local day

Enforced in two places, on purpose:

- The application rejects a duplicate with a readable error message.
- `@@unique([habitId, localDay])` makes it true under concurrent requests too,
  where the application check alone would lose a race.

### Streaks

`currentStreak` counts consecutive days ending **today**, or ending
**yesterday** when today has not been logged yet — a day that is still in
progress should not read as a broken streak. `longestStreak` is the longest run
anywhere in the habit's history. Both are computed on the server from stored
local days, so backfilling a gap recomputes them correctly on the next read and
the frontend never decides whether a streak is alive.

### When a user changes time zone

`User.timeZone` is mutable, but `CheckIn.localDay` is frozen at write time. A
user who moves from Kolkata to Berlin keeps their old check-ins on the days they
actually happened; only new check-ins use the new zone. Recomputing history
would silently move or merge past days, which is worse than the small
inconsistency it would fix.

### The trap this code deliberately avoids

`Intl` accepts bare abbreviations and resolves them to a guess: `IST` becomes
`Asia/Calcutta`, `EST` becomes `America/Panama`. But `IST` also means Irish and
Israel time. Storing one of those guesses would file a user's entire streak
history under the wrong calendar, so only unambiguous IANA IDs
(`Area/Location`, plus `UTC`) are accepted.

---

## Stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 |
| Backend  | Next.js route handlers                        |
| Database | PostgreSQL via Prisma 6                       |
| Tests    | Vitest                                        |
| Tooling  | TypeScript, ESLint, Prettier                  |

---

## Setup

Requires Node.js 20+ and a PostgreSQL database. A free hosted database
(Neon, Supabase) works without any local install.

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    then put your PostgreSQL connection string in DATABASE_URL

# 3. Create the tables
npm run db:deploy

# 4. Run it
npm run dev            # http://localhost:3000
```

Secrets live in `.env`, which is gitignored. `.env.example` documents every
variable the app needs and is the only env file in version control.

### Scripts

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Development server                            |
| `npm run build`      | Production build                              |
| `npm run test`       | Unit tests once                               |
| `npm run test:watch` | Unit tests in watch mode                      |
| `npm run typecheck`  | `tsc --noEmit`                                |
| `npm run lint`       | ESLint                                        |
| `npm run format`     | Prettier, writing changes                     |
| `npm run db:migrate` | Create and apply a migration in development   |
| `npm run db:deploy`  | Apply existing migrations (CI and production) |
| `npm run db:studio`  | Browse the database                           |

---

## Project layout

The tree is split by how much a file is allowed to touch.

```
src/lib/                pure code: no database, no environment, no clock
  local-day.ts          the only file that knows about time zones
  streaks.ts            current/longest streak maths over local days
  session-token.ts      JWT signing and verification, secret injected
  api-contract.ts       the response shapes, shared by server and browser
  validation/auth.ts    zod schemas for signup and login

src/server/             everything that touches infrastructure
  env.ts                the only file that reads process.env, validated with zod
  db.ts                 Prisma client singleton
  password.ts           bcrypt hashing
  session.ts            session cookie, getCurrentUser, requireUser
  api-error.ts          ApiError and the JSON error response
  handler.ts            route() wrapper and JSON body reading
  services/             business logic, the only place that queries Prisma

src/app/                routes and UI
prisma/schema.prisma    User, Habit, CheckIn
```

`.claude/` holds the local build-loop tooling and is deliberately gitignored; it
is not part of the deliverable.

Nothing in `src/lib/` imports from `src/server/`. `local-day.ts` and `streaks.ts`
never reach for Prisma, the environment, or the system clock — `todayIn(zone, now)`
takes the clock as an argument so tests are deterministic. Dependencies point one
way only:

```
route handler   thin: validate, call one service, shape the response
 ↓
service         business rules, the only caller of Prisma
 ↓
database
```

---

## Tests

```bash
npm run test
```

Local days and streaks: the worked example from the brief end to end,
same-local-day duplicates, both sides of a daylight-saving change, zones from
UTC+14 to UTC-11, half-hour offsets at the midnight boundary, month, year and
leap-day boundaries, and the ambiguous-abbreviation trap described above.

Auth: that an unknown email and a wrong password produce a byte-identical error,
that the login timing decoy is a real cost-12 hash and actually spends the time,
that a duplicate email surfaces as a readable 409 while an unrelated database
failure does not, that a password hash can never be returned to a caller, that a
token signed for a different purpose is rejected, and that the JSON body reader
cannot be fooled by a content type with `application/json` hidden in a parameter.

The whole suite runs without a database, a network, or a real clock.

---

## API

All responses are JSON. Errors share one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "fields": { "email": ["..."] }
  }
}
```

| Method | Path               | Purpose                                   |
| ------ | ------------------ | ----------------------------------------- |
| `POST` | `/api/auth/signup` | Create an account and start a session     |
| `POST` | `/api/auth/login`  | Start a session                           |
| `POST` | `/api/auth/logout` | End the session                           |
| `GET`  | `/api/auth/me`     | The current user, plus the server's today |

`GET /api/auth/me` returns `today` alongside the user because the server owns
what today is. The browser's clock and time zone are never trusted.

---

## Security decisions

Written down because each one is a trade-off, not an accident.

- **Passwords** are hashed with bcrypt at cost 12, and capped at 72 bytes
  because bcrypt silently ignores anything beyond that.
- **Login never reveals whether an email exists.** Unknown email and wrong
  password return the identical error, and an unknown email still spends the
  same bcrypt time against a decoy hash so the response timing matches.
- **Signup does reveal it**, by returning `409 EMAIL_TAKEN`. That is a
  deliberate trade: telling someone their email is already registered is worth
  more than the enumeration it allows, and the same information is available
  from any password-reset flow.
- **The session cookie** is `httpOnly`, `sameSite=lax`, `path=/`, and `secure`
  everywhere except an explicitly-set development environment, so an unset
  `NODE_ENV` fails closed rather than open.
- **The session token carries only a user id**, signed HS256 with an audience
  claim. The time zone is deliberately not in the token: it is read from the
  database each request, so a zone change applies immediately.
- **Sessions are stateless and therefore not revocable.** Logout clears the
  cookie, but a copied token stays valid until it expires after seven days. A
  session table would fix it; for this scope the cost was not worth it.
- **Request bodies are capped at 16KB**, read a chunk at a time so the limit
  holds even when the client sends no `content-length`.
- **Not built:** a read timeout. A client that declares a JSON body and then
  dribbles one byte per second holds a handler open, and a size cap cannot help
  because the body never gets large. Request timeouts belong to the platform
  (Vercel, nginx), not to application code.
- **Not built:** rate limiting on login. bcrypt at cost 12 costs about 220ms of
  CPU, so an unthrottled login endpoint is a denial-of-service surface. In
  production this belongs at the edge or in a shared store, not in app memory.

---

## Build status

| Step | Scope                                                         | Status |
| ---- | ------------------------------------------------------------- | ------ |
| 1    | Foundation: schema, migration, local-day and streak libraries | Done   |
| 2    | Auth: signup with time zone, login, sessions                  | Done   |
| 3    | API: habit CRUD, check-ins, validation, streak endpoints      | Next   |
| 4    | Frontend: dashboard, check-in, history, backfill              | To do  |
