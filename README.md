<div align="center">

# 🎛️ Lisa Omnipresent

**Personal command centre for the Lisa Kim ecosystem** — server monitoring, app admin, task management, docs, links, all in one PWA.

[![Version](https://img.shields.io/badge/version-v0.2.5-7f900?style=flat-square&labelColor=111111&color=e7f900)](https://github.com/Lisa-KimDev/lisa-omnipresent)
[![Status](https://img.shields.io/badge/status-live-brightgreen?style=flat-square&labelColor=111111)](https://github.com/Lisa-KimDev/lisa-omnipresent)
[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square&labelColor=111111&color=ffffff)](./LICENSE)

*Codename: **Ryu** · 🥋 Street Fighter Edition*

</div>

---

## Overview

Lisa Omnipresent is the admin dashboard PWA for the Lisa Kim + SoonSnap ecosystem. One app to rule them all — monitor your server, manage users, swap AI models, track video jobs, all from your phone.

Built dark-first with neon yellow (`#e7f900`) accents. Premium, minimal, functional.

---

## Features

### 🖥️ Server Monitoring
- Real-time CPU, RAM, Disk gauge rings
- Load history sparkline (CPU + RAM)
- SoonSnap worker status (running/stopped + PID)
- Storage breakdown (videos, captures, thumbnails)
- Load average (1m / 5m / 15m)
- Auto-refreshes every 5 seconds

### 🎛️ Apps Admin
- **User Management** — list all users, search, view credits/balance/tier, add/remove credits
- **LLM Picker** — fully configurable per tier:
  - Quick presets (Nemotron, Llama, DeepSeek, Gemma, OpenRouter, Custom)
  - Editable API URL, Model ID, API Key
  - Max tokens + temperature controls
  - Swaps take effect instantly — no redeploy needed
- **Video Queue** — filter by status (queued/running/completed/failed), progress bars, error messages
- **Rate Limits** — videos/day per tier (free vs paid)
- **Maintenance Mode** — kill video generation globally with one toggle

### ✅ Tasks
- Todo management linked to Supabase

### 📁 Docs
- Document storage and quick access

### 📧 Inbox
- Email inbox integration

### 🔗 Links
- Quick link bookmarks

### ⚙️ Settings
- Theme toggle (dark/light)
- Account management

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8** (build)
- **Tailwind CSS v4**
- **React Router v7**
- **Supabase JS v2** (auth + realtime)
- **PWA** (service worker, installable)

---

## Architecture

```
┌──────────────────────────────────────┐
│         Lisa Omnipresent PWA         │
│         (React + Vite, :8081)        │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Server   │  │      Apps        │  │
│  │  Monitor  │  │   ┌──────────┐  │  │
│  │           │  │   │  Users   │  │  │
│  │  CPU/RAM  │  │   │  LLM     │  │  │
│  │  Disk     │  │   │  Queue   │  │  │
│  │  Worker   │  │   │  Config  │  │  │
│  └─────┬─────┘  │   └──────────┘  │  │
│        │        └────────┬─────────┘  │
└────────┼─────────────────┼────────────┘
         │                 │
         ▼                 ▼
   Server Stats      Supabase REST
   API (:8090)       API (:8000)
         │                 │
         │           ┌─────┴──────┐
         │           │  app_config │
         │           │  users      │
         │           │  credits    │
         │           │  jobs       │
         │           └────────────┘
         ▼
   System metrics
   (cpu, mem, disk,
    docker, systemd)
```

---

## Navigation

8 tabs in a horizontally scrollable bottom nav:
`🎨 Creative` · `✅ Tasks` · `📁 Docs` · `📧 Inbox` · `🔗 Links` · `🖥️ Server` · `🎛️ Apps` · `⚙️ Settings`

---

## Server Stats API

The PWA talks to a lightweight Node.js stats API (`server-stats`) running on port 8090:

| Endpoint | Description |
|---|---|
| `GET /` | Full system stats (cached 5s) |
| `GET /system` | CPU, RAM, disk, load, uptime |
| `GET /docker` | Container statuses |
| `GET /soonsnap` | Video/capture/thumbnail storage |
| `GET /worker` | SoonSnap worker systemd status |
| `GET /supabase` | Database size + connections |
| `GET /admin-key` | Supabase service role key (for admin panel) |
| `GET /health` | Health check |

---

## Environment

The app connects to:
- **Supabase** at `http://173.249.36.76:8000` (self-hosted)
- **Server Stats API** at `http://173.249.36.76:8090`
- Auth uses the same Supabase instance as SoonSnap

---

## Development

```bash
npm install
npm run dev     # Vite dev server
npm run build   # Production build to dist/
```

Served as a static PWA via systemd `lisa-omnipresent.service` on port 8081.

---

## Deployment

```bash
npm run build
systemctl restart lisa-omnipresent
```

Auto-deploys from GitHub `main` branch.

---

<div align="center">

*Part of the Lisa Kim ecosystem · [SoonSnap](https://github.com/Richy-Soonak/soonsnap-app) · [Lisa Kim](https://github.com/Lisa-KimDev)*

**v0.2.5 "Ryu"** 🥋 · *First blood. The fundamentals are solid.*

</div>
