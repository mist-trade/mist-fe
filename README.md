<p align="right">
  <a href="./README.zh-CN.md">中文</a> | <strong>English</strong>
</p>

# Mist Frontend (mist-fe) — A-share Visual Trading Desk

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.1-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/TradingView-Lightweight_Charts-blue.svg" alt="Lightweight Charts" />
  <img src="https://img.shields.io/badge/License-BSD--3--Clause-green.svg" alt="License" />
</p>

Mist Frontend is a professional quantitative trading desk and Chan Theory geometric visualization workbench tailored for the **Chinese A-share market**, built on Next.js 16 (App Router) and React 19. Leveraging TradingView `lightweight-charts`, it delivers high-performance financial charts, authentic Chan Theory structural rendering, multi-layer visual inspection, streaming simulation controls, and market subscription management.

---

## 🌟 Core Features

- **Multi-Period Financial K-Lines & Indicator Charts**: Seamless switching across 1m/5m/15m/30m/60m/daily periods with smooth scaling powered by TradingView `lightweight-charts`. Multi-period synchronized sub-panels for MACD, RSI, KDJ, and volume profiles.
- **Authentic Chan Theory Geometric Visualization**:
  - **Merged K (Merge K)**: Dynamic recursive reduction by containment;
  - **Bi (Stroke)**: Clear differentiation of finalized (blue), unfinalized (purple), and initial strokes;
  - **Duan (Segment)**: Feature sequence segments with precise turning and break points;
  - **Zhongshu (Central Zone)**: Translucent rectangular zones rendering Phase A candidates and Phase B finalized consolidation zones;
  - **Buy/Sell Point Markers (BSP)**: Markers for Types 1, 2, and 3 (`1买`, `2买`, `3买`, `1卖`, `2卖`, `3卖`), strictly anchored to extreme morphological moments (`pivotTime`).
- **Multi-Layer Visualizer**: Interactive chart toolbar allowing independent toggling of: stroke lines (`chan_bi`), stroke zones (`chan_zs_bi`), segment lines (`chan_duan`), segment zones (`chan_zs_duan`), strategy signal markers, and raw buy/sell signals (`chan_bsp`).
- **Streaming Simulation Workbench**:
  - Push-driven simulation in local development via Server-Sent Events (SSE `text/event-stream`);
  - Full-featured transport controls: `play`, `pause`, `step_next`, `step_prev`, `seek`, and multi-speed adjustment;
  - **Strict Environment Isolation**: Gated by `isLocalDevEnvironment()`, active simulation controls are restricted to local development environments, automatically switching to read-only replay in production.
- **Quant Strategy Workbench & Market Subscriptions**: Strategy lifecycle management, rule configuration, live signal streaming, backtest submission, and live source allocation management.
- **React 19 Architecture**: Server Components paired with strict unified HTTP Envelope validation (`parseEnvelope`), ensuring type safety and resilient cross-repo communication.

---

## 🏛️ Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                       │
│  /k (K-line)  |  /chan (Dual-TF Chan)  |  /backtests        │
│  /strategies (Strategy Workbench)      |  /settings (Subs)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │     app/api/client.ts       │
                │ (Unified API Client &       │
                │  Envelope Validation)       │
                └──────────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ Next.js Rewrites (Same-Origin Proxy)│
            ▼                                     ▼
   /api/mist/:path*                      /api/chan/:path*
            │                                     │
            └──────────────────┬──────────────────┘
                               │ HTTP (:8001)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 mist-backend (:8001)                        │
│ Main API / Ingress / Indicators / Chan Geometry (/v1/chan/) │
│ (Legacy chan-api :8008 is fully consolidated into :8001)    │
└─────────────────────────────────────────────────────────────┘
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

Copy the environment template:
```bash
cp .env.example .env.local
```

Example `.env.local` (development proxies to backend via Next.js rewrites):
```env
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8001
NEXT_PUBLIC_API_TIMEOUT=30000
```

> [!TIP]
> The legacy standalone `chan-api` (8008) has been consolidated into `mist-backend` (8001). `CHAN_API_PROXY_TARGET` gracefully defaults to `MIST_API_PROXY_TARGET`.

### 3. Start dev server

```bash
pnpm dev
```

Open in browser:
- **K-line & Overview Workbench**: `http://localhost:3000/k`
- **Dual-Timeframe Chan Panel**: `http://localhost:3000/chan`
- **Backtest & Simulation Workbench**: `http://localhost:3000/backtests`
- **Strategy Workbench**: `http://localhost:3000/strategies`
- **Subscription Settings**: `http://localhost:3000/settings`
- **Chan Regression Panel**: `http://localhost:3000/chan-tests`

---

## 🧪 Testing & Quality Gates

```bash
# Run unit tests
pnpm test

# CI serial test suite
pnpm run test:ci

# Lint & type check
pnpm run lint
pnpm run typecheck

# Chan regression snapshot generation
pnpm run snapshots:generate
```

---

## 📂 Pages & Module Layout

```text
app/
├── api/                   # API client, contract types, and envelope validation (client.ts, types.ts)
├── components/            # UI components (tv-chart TradingView charts, ErrorBoundary, etc.)
├── k/                     # /k core financial K-line page
├── chan/                  # /chan dual-timeframe Chan Theory page
├── backtests/             # /backtests backtest management & streaming simulation workbench
├── strategies/            # /strategies strategy workbench
├── settings/              # /settings market-data subscription settings
├── chan-tests/            # /chan-tests regression snapshot workbench
├── dashboard/             # /dashboard overview dashboard
├── layout.tsx             # Root layout
└── globals.css            # Tailwind CSS global styles
```

---

## 📄 License

Licensed under [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause).
