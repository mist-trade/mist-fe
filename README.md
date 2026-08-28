<p align="right">
  <a href="./README.zh-CN.md">中文</a> | <strong>English</strong>
</p>

# Mist Frontend (mist-fe) — A-share Visual Trading Desk

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.1-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/ECharts-6.0-red.svg" alt="ECharts" />
</p>

A-share visual trading desk built on Next.js 16 (App Router) & React 19. Renders Chan Theory geometry, multi-period K-lines, and strategy workbenches via high-performance financial charts.

> See [README.zh-CN.md](./README.zh-CN.md) for Chinese.

---

## 🌟 Core Features

- **Multi-period K-line & indicator charts**: 1m/5m/15m/30m/60m/daily with synchronized MACD, RSI, KDJ sub-panels.
- **Authentic Chan Theory geometry**:
  - **Merged K**: dynamic reduction by containment.
  - **Bi (Stroke)**: finalized (blue), unfinalized (purple) & initial strokes.
  - **Duan (Segment)**: feature-sequence segments with precise break points.
  - **Zhongshu (Central Zone)**: translucent rectangles for Phase A candidates & Phase B finalized zones.
  - **BSP (Buy/Sell Points)**: markers for Types 1/2/3.
- **Quant strategy workbench**: lifecycle definition, rule configuration, realtime signal refresh, backtest submission & alert acknowledgement.
- **Subscription console**: live TDX/QMT source status & 5-symbol allocation pool with one-click activate/deactivate.
- **Chan regression snapshot workbench**: built-in `/chan-tests` page with snapshot diff tooling for rendering fidelity.
- **React 19 streaming**: Server Components with `use()` over unresolved Promises for skeleton & progressive chart streaming.

---

## 🏛️ App Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                       │
│  /k (K-line)  |  /strategies (Strategy)  |  /settings (Subs)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │     app/api/client.ts       │
                │ (Unified API Client &       │
                │  Envelope Unwrapping)       │
                └──────────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ Next.js Rewrites (Same-origin Proxy │
            │              / Production Gateway)   │
            ▼                                     ▼
   /api/mist/* (:8001)                   /api/chan/* (:8008)
(Main backend / Market /              (Chan stateless compute
 Strategy / Subscriptions)              microservice)
```

---

## 📋 Requirements

- **Node.js**: `>= 24.0.0`
- **Package manager**: `pnpm` (`pnpm install --frozen-lockfile`)

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the env template:

```bash
cp .env.example .env.local
```

Example (dev proxies to backends via Next.js rewrites):

```env
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000
```

### 3. Start dev server

```bash
pnpm dev
```

Open in browser:
- **K-line & Chan workbench**: `http://localhost:3000/k`
- **Strategy workbench**: `http://localhost:3000/strategies`
- **Subscription settings**: `http://localhost:3000/settings`
- **Chan regression panel**: `http://localhost:3000/chan-tests`

---

## 🧪 Testing & Quality Gates

```bash
# Unit tests
pnpm test

# CI (serial)
pnpm run test:ci

# Lint & typecheck
pnpm run lint
pnpm run typecheck

# Chan regression snapshot generation
pnpm run snapshots:generate
```

---

## 📂 Pages & Module Layout

```text
app/
├── api/                   # API client & contract types (client.ts, types.ts)
├── components/            # UI component library
│   ├── k-panel/           # K-line & ECharts rendering components
│   └── ErrorBoundary.tsx  # Component-level error boundary
├── k/                     # /k core K-line page
├── strategies/            # /strategies strategy & backtest workbench
├── settings/              # /settings subscription settings
├── chan-tests/            # /chan-tests Chan regression panel
├── dashboard/             # /dashboard overview dashboard
├── layout.tsx             # Root layout
└── globals.css            # Tailwind CSS global styles
```

---

## 🚢 Production Container & Deployment

Production images & deployment are managed by `mist-deploy` (`node:24-alpine`):

```bash
# Build local test image
docker build -t ghcr.io/mist-trade/mist-fe:local .

# Run container
docker run --rm -p 3000:3000 ghcr.io/mist-trade/mist-fe:local
```

Nginx gateway keeps frontend & backend APIs same-origin.

---

## 📄 License

Proprietary core component of a private quant system — all rights reserved.
