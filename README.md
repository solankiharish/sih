<<<<<<< HEAD
# sih
=======
# SecureDocs — SIH26190 Prototype

**Secure Digital Document Management System for Legal and Investigation Documents**
Smart India Hackathon 2026 · Ministry of Home Affairs · Theme: Blockchain & Cybersecurity

This is a **demo-stage prototype** built to show the core working model. It
deliberately does **not** include blockchain anchoring or AI features yet —
those are planned for the final submission. What it *does* show, fully working:

  as plaintext on disk)
  (the hook where blockchain anchoring will plug in later)


## Project structure

```
sih26190/
├── backend/              Express API (Node.js)
│   ├── server.js         entry point — also serves the frontend
│   ├── routes/           auth, documents, audit
│   ├── middleware/       JWT auth + role guard
│   ├── utils/            AES-256-GCM + SHA-256 helpers, JSON "DB", seeding
│   ├── data/             JSON data files (auto-created on first run)
│   ├── uploads/          encrypted file blobs (auto-created)
│   └── .env              secrets (JWT secret, AES key) — demo values included
└── frontend/              Plain HTML/CSS/JS single-page app
    ├── index.html
    ├── css/style.css
    └── js/ (api.js, app.js)
```

## How to run (VS Code / any machine with Node.js)

1. Open the `sih26190` folder in VS Code.
2. Open a terminal in `backend/` and install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser at **http://localhost:5000** — the backend serves the
   frontend automatically, so this is the only URL you need.

That's it — one server, one port, no build step, no Docker needed for the demo.

## Deploy with Docker on DigitalOcean

The app is packaged as one container and listens on port `5000`. The JSON data
and encrypted uploads are stored in named Docker volumes so container rebuilds
do not delete them.

### DigitalOcean Droplet

1. Create a Droplet with Docker preinstalled, then clone this repository onto it.
2. Create the runtime environment file:
   ```bash
   cp .env.example .env
   ```
3. Replace both values in `.env`. Generate the AES key with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Build and start the service:
   ```bash
   docker compose up -d --build
   ```
5. Allow TCP port `5000` in the Droplet firewall, or put a reverse proxy with
   HTTPS in front of the container and proxy to `localhost:5000`.

Check the service with:
```bash
curl http://your-droplet-ip:5000/api/health
```

View logs with `docker compose logs -f`, and stop the service with
`docker compose down`. Do not run `docker compose down -v` unless you intend to
delete the application data and encrypted uploads.

### DigitalOcean App Platform

Create an App from this repository, choose **Dockerfile**, and use the
repository root as the build context. Set `PORT`, `JWT_SECRET`, and
`AES_SECRET_KEY` as encrypted environment variables, and route external HTTP
traffic to port `5000`. For production evidence storage, use a Droplet or an
external database/object store with backups because this prototype uses local
JSON files and local encrypted uploads.

### Demo logins (seeded automatically on first run)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Investigator | `investigator1` | `Invest@123` |
| Judge | `judge1` | `Judge@123` |

## Demo flow for the presentation

1. **Login as `investigator1`** → go to "Upload Evidence" → upload any file
   with a Case ID (e.g. `FIR-2026-00451`) and a title. Point out that the
   file is encrypted with AES-256-GCM and hashed with SHA-256 before it
   ever touches disk.
2. Go to **Documents** → click **"Verify Integrity"** to show the
   stored-hash vs recomputed-hash check passing.
3. Click **"View / Decrypt"** to show the file being decrypted on the fly
   and previewed in the browser.
4. **Logout, login as `judge1`** → show that the judge can view/verify the
   same evidence (read-only) but has no Upload option — role separation.
5. **Logout, login as `admin`** → show **"Manage Users"** (create an
   investigator/judge account live) and the **"Audit Log"** tab, which is
   the chain-of-custody trail: every login, upload, and view is recorded
   with who/what/when.

## What's next (final submission, not in this prototype)

  tamper-*proof* (not just tamper-evident) chain of custody

## Security note

The `.env` file ships with demo secrets so the project runs out of the box.
**Rotate `JWT_SECRET` and `AES_SECRET_KEY` before any real deployment** —
generate a new AES key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
>>>>>>> fe26bcb (Add Docker deployment setup)
