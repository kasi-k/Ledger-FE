# Maarr Ledger — Frontend

Next.js (App Router) UI for the Maarr Smart Monthly Ledger — an Excel-style
running ledger (**Particulars · Debit · Credit · Balance**) with per-month
carry-forward, month locks, claimable statements, invoice attachments, and a
saved-reports view.

Talks to the backend API over HTTP; it has no server-side data of its own.

## Requirements

- Node.js **>= 18.18**
- The backend API running and reachable (see the `backend` project).

## Setup

```bash
npm install
# point at your backend (defaults to http://localhost:4100 if unset):
echo "NEXT_PUBLIC_API_URL=http://localhost:4100" > .env.local
npm run dev            # http://localhost:3000
```

## Environment variables

| Key | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API. Default `http://localhost:4100`. |

## Build

```bash
npm run build
npm start              # serves the production build (respects PORT)
```

## Deploy to Vercel

- Import this repo into Vercel (framework **Next.js** is auto-detected).
- If this lives in a monorepo, set **Root Directory** to this folder.
- Add the environment variable **`NEXT_PUBLIC_API_URL`** = your deployed backend
  URL (e.g. `https://maarr-ledger-api.onrender.com`).
- Deploy.

After deploying, set the backend's `CORS_ORIGIN` to this frontend's URL.

## Assets

- `public/maarrlogo.jpeg` — the logo shown in the app header and on the login page.
