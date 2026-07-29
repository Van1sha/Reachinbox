# ReachInbox — Production-Grade Email Scheduler

A full-stack email scheduling service with a live dashboard — built as a take-home for ReachInbox.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Next.js 16     │────▶│  Express API     │────▶│  PostgreSQL │
│  (Frontend)     │     │  (Backend)       │     │  (Database) │
│  port 3000      │     │  port 4000       │     │  port 5432  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                                │
                         ┌──────┴──────┐
                         │   Redis     │
                         │  (BullMQ)   │
                         │  port 6379  │
                         └─────────────┘
```

## ✨ Features

- **📅 Email Scheduling** — Schedule campaigns to any number of recipients at a specific time
- **⚡ BullMQ + Redis** — Persistent job queue that survives server restarts
- **📬 Custom SMTP** — Use any SMTP provider (Gmail, Outlook, Ethereal, etc.)
- **🔄 Adaptive Rate Limiting** — Per-sender hourly limits with BullMQ's built-in limiter
- **📊 Live Dashboard** — Real-time stats via SSE (Server-Sent Events)
- **📡 Timeline View** — Live email status feed as jobs are processed
- **🔁 Auto Retry** — Exponential backoff with jitter for failed sends
- **🛡️ Bull Board** — Visual queue monitor at `/admin/queues`

## 🧪 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), Tailwind CSS v4 |
| **Backend** | Express.js, TypeScript |
| **Queue** | BullMQ + Redis |
| **Database** | PostgreSQL + TypeORM |
| **SMTP** | Nodemailer (Ethereal or custom SMTP) |
| **Real-time** | Server-Sent Events (SSE) |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (or [Memurai](https://www.memurai.com/) on Windows)

### 1. Clone & Install

```bash
git clone https://github.com/Van1sha/Reachinbox.git
cd Reachinbox

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your DB and Redis URLs

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Setup Database

```bash
# Create PostgreSQL database
createdb reachinbox_db

# Tables are auto-created via TypeORM sync on first run
```

### 4. Start Redis

```bash
# Linux/Mac
redis-server

# Windows — use Memurai or WSL
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:3000**

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/dev-login` | Dev login (no OAuth needed) |
| `GET` | `/api/senders` | List all senders |
| `POST` | `/api/senders` | Add custom SMTP sender |
| `POST` | `/api/senders/seed` | Auto-create 3 Ethereal senders |
| `POST` | `/api/campaigns` | Create & schedule a campaign |
| `GET` | `/api/campaigns` | List campaigns |
| `POST` | `/api/campaigns/preview` | Preview adaptive schedule |
| `GET` | `/api/jobs` | List email jobs |
| `GET` | `/api/stats` | Dashboard stats |
| `GET` | `/api/events` | SSE stream for real-time updates |
| `GET` | `/admin/queues` | Bull Board queue monitor |

## 📬 Using Your Own Gmail

1. Enable 2-Step Verification on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate an App Password for "Mail"
4. In the Compose modal → Step 3 → click **"+ Add Custom SMTP Sender"**
5. Enter: Host `smtp.gmail.com`, Port `587`, your Gmail, and the App Password

## 🔧 Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required variables.

## 📁 Project Structure

```
reachinbox/
├── backend/
│   ├── src/
│   │   ├── config/       # DB, Redis, BullMQ, Passport
│   │   ├── middleware/   # Auth, error handling
│   │   ├── models/       # TypeORM entities
│   │   ├── routes/       # Express routers
│   │   ├── services/     # Email sender, SSE
│   │   └── workers/      # BullMQ email worker
│   └── package.json
└── frontend/
    ├── app/              # Next.js App Router pages
    ├── components/       # UI, dashboard, compose, timeline
    ├── lib/              # API client, utils
    └── types/            # TypeScript interfaces
```
