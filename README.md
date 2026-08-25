# Habit Tracker with Streaks

Define habits, check in once a day, and see your current and longest streaks —
counted in **your own local days**, never in elapsed hours.

> Two check-ins twenty hours apart may be the same day or two different days.
> Only the user's time zone decides which. Everything here follows from that.

---

## Quick start

Needs Node.js 20+ and a PostgreSQL database. A free hosted one (Neon, Supabase)
works with no local install.

```bash
npm install
cp .env.example .env     # then add your DATABASE_URL and SESSION_SECRET
npm run db:deploy        # create the tables
npm run dev              # http://localhost:3000
```

Secrets live in `.env`, which is gitignored. `.env.example` is the only env file
in version control, and `src/server/env.ts` is the only file that reads one.

---

## Where to look first

| File                                                                                 | Why                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`src/lib/local-day.ts`](src/lib/local-day.ts)                                       | The only file that knows time zones exist.            |
| [`src/lib/streaks.ts`](src/lib/streaks.ts)                                           | Streaks, as pure calendar arithmetic.                 |
| [`src/server/services/check-in.service.ts`](src/server/services/check-in.service.ts) | The four rules a check-in must pass.                  |
| [`check-in.service.test.ts`](src/server/services/check-in.service.test.ts)           | The brief's worked example, through the real service. |

---

## How local days work

**A local day is a string, not a `Date`.**

A `Date` is an _instant_. `2026-03-12` is not an instant — it is a square on
somebody's calendar. Store it as a timestamp and every layer below (driver, ORM,
JSON, browser) gets another chance to shift it by a day.

So it stays the string `YYYY-MM-DD`, and three things come free:

- ISO strings sort chronologically, so plain string sorting is date sorting.
- Daylight saving stops mattering. A 23-hour day is still one calendar square.
- What leaves the database is what was written.

**The conversion happens exactly once, at the edge.**

```
UTC instant + IANA zone
  ↓  toLocalDay()        ← the only time-zone conversion in the app
"2026-03-12"
  ↓  computeStreaks()    ← pure calendar maths, no zones involved
{ currentStreak, longestStreak }
```

That is why the logic is testable with no database, no clock and no server.

**A check-in stores both facts, because they differ.**

| Column        | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| `checkedInAt` | The exact UTC instant the row was written.            |
| `localDay`    | The calendar square it counts for. Streaks read this. |

For a backfill they disagree on purpose: `localDay` is in the past while
`checkedInAt` is now. That is what makes backfilling honest.

---

## The four rules a check-in must pass

All four live in the service, never in a route handler.

| Rule                                     | Response                 |
| ---------------------------------------- | ------------------------ |
| The habit must belong to the caller      | `404 NOT_FOUND`          |
| The day cannot be in the caller's future | `400 VALIDATION_ERROR`   |
| The day cannot precede the habit         | `400 VALIDATION_ERROR`   |
| The day cannot already be checked in     | `409 DUPLICATE_CHECK_IN` |

Two are time-zone questions, not clock questions:

- **"Future" means future for this user.** At `2026-03-11T21:30Z` it is the 12th
  in Kolkata and still the 11th in London. The same request is valid for one and
  premature for the other.
- **"Before the habit existed"** compares calendar days. The habit's creation
  instant is converted into the caller's own calendar first.

Another user's habit is reported as **missing, not forbidden** — a 403 would
confirm the id exists.

**Duplicates are blocked twice.** The service returns a readable error, and
`@@unique([habitId, localDay])` holds under concurrent requests. It inserts and
catches the violation rather than reading first, because a double-tapped button
is exactly the race a read-then-write would lose.

---

## Streaks

`currentStreak` counts consecutive days ending **today**, or **yesterday** if
today is not logged yet — a day still in progress is not a broken streak.
`longestStreak` is the longest run ever.

Both are computed on the server from stored local days, so backfilling a gap
recomputes them on the next read. **The frontend never decides if a streak is
alive**, and never computes a date at all.

---

## Decisions worth knowing

| Decision                                       | Why                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Changing time zone does not rewrite history    | `localDay` is frozen at write time. Recomputing would silently move or merge past days.       |
| Only unambiguous IANA IDs accepted             | `Intl` maps `IST` to India and `EST` to Panama. `IST` is also Irish and Israel time.          |
| Passwords: bcrypt cost 12, capped at 72 bytes  | bcrypt silently ignores anything past 72 bytes, so two long passwords could share a prefix.   |
| Login never reveals whether an email exists    | Identical error either way, and an unknown email still spends the same time on a decoy hash.  |
| Signup does reveal it, via `409 EMAIL_TAKEN`   | A deliberate trade — the same fact leaks from any password-reset flow.                        |
| The session token names a session row          | The signature proves it was not forged; the row proves it is still meant to be alive.         |
| Logging out really revokes                     | The row is deleted before the cookie is cleared, so a copied cookie dies on its next request. |
| The time zone is never in the token            | It is read through the session row, so a change applies immediately.                          |
| Cookie is `httpOnly`, `sameSite=lax`, `secure` | Only an explicit development environment relaxes `secure`, so an unset `NODE_ENV` fails safe. |
| Request bodies capped at 16KB                  | Read a chunk at a time, so the cap holds even with no `content-length` header.                |

**Deliberately not built:** rate limiting and read timeouts (both belong at the
edge, not in app memory), and pagination on check-in history (one row per day
means a year is 365 rows).

---

## API

All responses are JSON. Requests must set `Content-Type: application/json`.
Errors share one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "fields": { "email": ["..."] }
  }
}
```

| Method   | Path                        | Purpose                                    |
| -------- | --------------------------- | ------------------------------------------ |
| `POST`   | `/api/auth/signup`          | Create an account and start a session      |
| `POST`   | `/api/auth/login`           | Start a session                            |
| `POST`   | `/api/auth/logout`          | End the session                            |
| `GET`    | `/api/auth/me`              | The current user, plus the server's today  |
| `GET`    | `/api/habits`               | The caller's habits, each with its streaks |
| `POST`   | `/api/habits`               | Create a habit                             |
| `GET`    | `/api/habits/:id`           | One habit plus its full check-in history   |
| `PATCH`  | `/api/habits/:id`           | Rename it or change its description        |
| `DELETE` | `/api/habits/:id`           | Delete it and its check-ins                |
| `POST`   | `/api/habits/:id/check-ins` | Check in for today, or backfill a past day |

`POST .../check-ins` takes an optional `localDay`. Omit it for today — that is
what the one-click button sends, so the browser's clock is never consulted. The
response returns the habit with streaks already recomputed.

---

## Architecture

Split by how much a file is allowed to touch.

```
src/lib/         pure: no database, no environment, no clock
src/server/      anything touching infrastructure; services own all Prisma calls
src/client/      browser-side I/O, the mirror of src/server/
src/components/  UI, on shadcn/ui primitives in components/ui/
src/app/         routes and pages
prisma/          User, Session, Habit, CheckIn
```

Nothing in `src/lib/` imports from `src/server/`, enforced by `server-only` and
`client-only` markers rather than by convention. Dependencies point one way:

```
route handler   thin: validate, call one service, shape the response
 ↓
service         business rules, the only caller of Prisma
 ↓
database
```

Reads and writes take different paths on purpose. A **page** is server code, so
it calls the service directly — streaks are correct on first paint, with no
spinner. A **button** goes through the public API, so the documented endpoints
are the real product surface and the four rules run on the path a reviewer can
`curl`. After a write the client calls `router.refresh()` rather than patching
state, because the server already returned the recomputed numbers.

**The interface** is [shadcn/ui](https://ui.shadcn.com), with light/dark/system
themes, a searchable time-zone picker (there are over four hundred), and a
confirmation dialog before deleting. Server errors render under the field they
belong to; the error `code` lets a duplicate read as "already done today" rather
than as a generic failure.

---

## Tests

```bash
npm run test        # 160 tests, no database, no network, no real clock
```

- **Local days and streaks** — the brief's worked example, same-day duplicates,
  both sides of a daylight-saving change, UTC+14 to UTC-11, half-hour offsets at
  midnight, month/year/leap-day boundaries, and the abbreviation trap.
- **Check-ins** — each of the four rules, that "future" and "before the habit
  existed" are decided per user and not per server clock, that a backfill closing
  a gap recomputes the streak, and that habits are only ever queried by owner.
- **Auth** — that unknown email and wrong password give a byte-identical error,
  that the timing decoy really spends the time, and that a password hash can
  never be returned to a caller.
- **Browser** — that the API client serialises its body, handles a 204, carries
  the server's wording through, and that the signup form submits the time zone it
  is showing.

---

## Scripts

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Development server                            |
| `npm run build`      | Production build                              |
| `npm run test`       | Run the tests once                            |
| `npm run typecheck`  | `tsc --noEmit`                                |
| `npm run lint`       | ESLint                                        |
| `npm run format`     | Prettier, writing changes                     |
| `npm run db:migrate` | Create and apply a migration in development   |
| `npm run db:deploy`  | Apply existing migrations (CI and production) |
| `npm run db:studio`  | Browse the database                           |
