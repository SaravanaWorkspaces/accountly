# Accountly

A quiet ledger for the people and shops you deal with. Add a **party** (a customer
or a merchant), then log what you **received** and what you **paid** — with the
receipt or bill attached. Accountly keeps a running balance per party and tells
you, in plain words, whether they owe you or you owe them.

Built from the Accountly design canvas: cream paper, Instrument Serif headings,
monospaced money, and two ways to read a ledger — chat-style **bubbles** or a
tabular **statement**.

## Stack

Deliberately small. One process, one file on disk, no external services.

| Concern    | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, React 19, Server Actions)              |
| Language   | TypeScript, strict                                             |
| Styling    | Tailwind CSS v4, design tokens in `src/app/globals.css`         |
| Database   | SQLite via `better-sqlite3` + Drizzle ORM                       |
| Migrations | `drizzle-kit`, applied automatically on first connection        |
| Files      | Vercel Blob (private) or `data/uploads`, served through an authorised route |
| Auth       | Optional single passcode, signed session cookie (`jose`)         |

There is no API layer to keep in sync: pages read through `src/lib/queries.ts`
on the server, and writes go through Server Actions in `src/lib/actions.ts`.

## Receipts

An entry can carry images and PDFs, **up to 2 MB each** and
`MAX_FILES_PER_ENTRY` of them — both in `src/lib/upload-limits.ts`. The entry
sheet turns away anything larger before it is queued, and `storeUpload` checks
the declared size, the real byte length and the file's magic bytes again on the
server, because the client is not a boundary.

Where they land depends on one variable:

| `BLOB_READ_WRITE_TOKEN` | Receipts go to                                    |
| ----------------------- | ------------------------------------------------- |
| set                     | Vercel Blob, with `access: "private"`             |
| unset                   | `UPLOAD_DIR` on local disk                        |

**Set it on Vercel.** A serverless filesystem is ephemeral, so a receipt written
to `data/uploads` there is gone by the next request. Create a Blob store in the
Vercel dashboard and the token is injected into the deployment for you; for a
local run against the same store, copy it into `.env`.

Blobs are stored **private, never public**. A public blob URL would hand out
bills and invoices to anyone who ever saw the link, and would keep working after
the passcode changed. Receipts are read back through `/api/files/[id]`, which
sits behind the same auth gate as everything else — so the URLs in the app do
not change with the storage backend.

Which store holds a given file is recorded in the key (`blob:` prefixed keys are
in Vercel Blob, bare ones are on disk), so turning the token on does not strand
receipts that were written before it.

> One entry's worth of receipts travels in a single Server Action request. On
> Vercel, a function request body is capped at 4.5 MB regardless of
> `serverActions.bodySizeLimit`, so about two 2 MB receipts per entry is the
> practical ceiling there. Lower `MAX_FILES_PER_ENTRY`, or move to Vercel Blob
> client uploads, if you need more in one go.

## Getting started

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (see below)
npm run db:migrate
npm run db:seed               # optional: the sample ledger from the design
npm run dev                   # http://localhost:3000
```

### Environment

| Variable               | Required            | Meaning                                                                 |
| ---------------------- | ------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | no                  | Path to the SQLite file. Default `./data/accountly.db`.                  |
| `UPLOAD_DIR`           | no                  | Where receipts are stored. Default `./data/uploads`.                     |
| `AUTH_SECRET`          | with `APP_PASSCODE` | 32+ chars, signs the session cookie.                                     |
| `APP_PASSCODE`         | no                  | Set it and the app is gated. Leave unset and it runs open.               |
| `NEXT_PUBLIC_CURRENCY` | no                  | Currency symbol. Default `₹`.                                            |
| `NEXT_PUBLIC_LOCALE`   | no                  | Number and date locale. Default `en-IN`.                                 |
| `TZ`                   | no                  | Pins what the server calls "today" — set it to your own zone.            |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running in production

```bash
npm ci
npm run build
APP_PASSCODE='…' AUTH_SECRET='…' TZ=Asia/Kolkata npm start
```

Put it behind TLS (a reverse proxy is fine). The session cookie is marked
`Secure` whenever `NODE_ENV=production`, so a plain-HTTP production host will
not be able to hold a session — that is on purpose.

**Set `APP_PASSCODE` on anything reachable from a network.** Without it every
visitor can read and write the ledger. With it, one shared passcode opens a
30-day session, and the gate in `src/proxy.ts` covers pages, Server Actions and
the attachment route alike.

### Backups

The database lives in `data/accountly.db`, and receipts live beside it in
`data/uploads` unless `BLOB_READ_WRITE_TOKEN` is set, in which case Vercel Blob
holds them and only the database needs backing up here. SQLite runs in WAL mode,
so copy it with the tool that understands that:

```bash
sqlite3 data/accountly.db ".backup '/backups/accountly-$(date +%F).db'"
cp -r data/uploads /backups/uploads-$(date +%F)
```

## Layout

```
src/
  app/
    page.tsx              parties list + search
    p/[id]/page.tsx       one party: balance, entry buttons, ledger
    login/page.tsx        passcode gate (only when APP_PASSCODE is set)
    api/files/[id]/       serves an attachment, behind the same auth
  components/             sheets, ledger views, cards — client where needed
  db/                     schema, connection, migrate + seed CLIs
  lib/
    queries.ts            all reads (balances are summed in SQL)
    actions.ts            all writes (Server Actions)
    money.ts dates.ts     formatting rules shared by server and client
    storage.ts            upload validation and on-disk storage
    session.ts auth.ts    edge-safe signing / Node-side checks
  proxy.ts                the auth gate
tests/
  features.mjs            full feature sweep (59 checks)
  smoke.mjs               shorter end-to-end smoke test
```

## Design decisions worth knowing

**Money is integer minor units.** Amounts are stored in paise, never floats, so
a balance is always exact. Display rounds to whole units, as the design does —
enter `2400.75` and the ledger shows `₹2,401`. Two rounded rows therefore need
not visibly add up to a rounded total; the stored values always do.

**Balances are computed, never stored.** `listParties` sums `dir × amount` in
SQL, so a balance can never drift out of sync with its entries. `in` and
`advance received` count `+1`, `paid` and `advance paid` count `-1`, on top of
the opening balance.

**"Today" comes from the server.** Day labels are resolved once per request and
passed down as props, so server output and client hydration always agree. Set
`TZ` to control which day that is.

**Uploads are checked, not trusted.** Type allow-list, 15 MB cap, six files per
entry, and a magic-byte sniff so a renamed file cannot pose as a JPEG. Stored
under a generated name; the original filename is only ever a label.

**Search lives in the URL.** `/?q=ramesh` is shareable and survives a reload.

**The ledger style is a cookie.** Bubbles or statement, remembered across
parties, and read on the server so the first paint is already right.

## Database commands

```bash
npm run db:migrate   # apply migrations (also runs automatically on connect)
npm run db:seed      # add the design's sample ledger, if the DB is empty
npm run db:reset     # wipe, migrate, seed
npm run db:clear     # wipe to a completely empty ledger, schema only
npm run db:generate  # regenerate SQL after editing src/db/schema.ts
```

`db:clear` removes `data/accountly.db` and `data/uploads` and re-applies
migrations, leaving you on the "Nobody here yet" empty state.

## Tests

Both suites drive a real Chromium against a running server.

```bash
npx playwright install chromium   # once
npm run build && npm start        # in one shell
```

**`npm run test:features`** — the full sweep, 59 checks. Run it against an
**empty** database (`npm run db:clear` first): it starts on the empty state and
walks the app the way a first-time owner would — first party, all four entry
types and their effect on the balance, both ledger views and day grouping,
image and PDF attachments, the viewer, validation, search, the not-found pages,
and no horizontal overflow at 320 / 375 / 414 / 768 / 1024 / 1440 px.

**`npm run test:e2e`** — a shorter smoke test over the same core flow.

Both write real parties and entries, so point them at a scratch database.
