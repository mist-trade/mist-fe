# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mist Frontend** is a Next.js application for financial charting and technical analysis, specifically designed for Chinese stock market data visualization. Implements advanced charting capabilities using ECharts with custom Chan Theory (缠论) patterns.

**Tech Stack**: Next.js 16.1.4 (App Router), React 19.2.3, TypeScript 5, ECharts 6.0.0, Tailwind CSS 4

## Quick Start

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                    # http://localhost:3000

# Production
pnpm build
pnpm start

# Code quality
pnpm lint                   # ESLint
pnpm test                   # Jest tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
```

---

## Architecture

### App Router Structure

```
app/
├── api/                    # API routes & data fetching
│   ├── fetch.ts            # API client & data fetching
│   └── mock-data/          # Mock datasets for development
│       └── index.ts        # Unified mock data source
├── components/
│   ├── k-panel/            # Main K-chart component
│   │   ├── index.tsx       # K-line chart with ECharts
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useChartData.ts      # Data processing
│   │   │   ├── useChartConfig.ts    # Chart configuration
│   │   │   └── useChartRender.ts    # ECharts rendering
│   │   ├── utils/         # Utility functions
│   │   │   ├── dataProcessor.ts     # Pure calculations
│   │   │   └── formatters.ts        # Data formatting
│   │   ├── config/        # Configuration constants
│   │   │   ├── chartColors.ts       # Color schemes
│   │   │   └── chartOptions.ts      # Chart options
│   │   ├── types/         # TypeScript definitions
│   │   ├── __tests__/     # Unit tests
│   │   └── skeleton.tsx   # Loading skeleton
│   └── ErrorBoundary.tsx  # Error boundary
├── k/
│   └── page.tsx           # K-line chart page route
├── layout.tsx             # Root layout
└── globals.css            # Tailwind v4 global styles
```

### Data Flow Pattern

**Key Architecture**: Server components fetch data via `app/api/fetch.ts`, pass **unresolved Promises** to client components, which use React 19's `use()` hook to unwrap them.

**Why this pattern**: Enables streaming and progressive rendering. The `use()` hook suspends the component until data is available.

```
Server Component (page.tsx)
    ↓
fetch.ts returns Promises
    ↓
Client Component (KPanel) receives Promises
    ↓
use() hook unwraps Promises
    ↓
ECharts renders chart
```

---

## Component Architecture

### KPanel Component Structure

The KPanel component follows a modular architecture:

```typescript
<KPanel>
  ├── useChartData       // Data processing & transformation
  ├── useChartConfig     // Chart configuration & series creation
  └── useChartRender     // ECharts initialization & updates
</KPanel>
```

**Separation of Concerns**:
- **useChartData**: Processes raw data into chart-ready format
- **useChartConfig**: Creates ECharts configuration and series
- **useChartRender**: Manages ECharts lifecycle

---

## Chart Architecture (app/components/k-panel/index.tsx)

### Custom ECharts Series

The K-panel implements sophisticated charting with:

- **Custom series type**: Uses `custom` series for overlay graphics
- **Placeholder arrays**: Efficient mapping between data layers
- **Multi-layered Rendering**:
  - K-line candlesticks (base data)
  - Merge K (合并K) - translucent rectangles
  - Trend lines (笔) - lines showing significant movements
  - Channels (中枢) - consolidation zones

### Rendering Layers (z-index)

```
K-line (candlestick):  z=0
Volume:                z=1
Channel:               z=3
Merge K:               z=5
Bi (trend lines):      z=10
```

### Key Implementation Pattern

```typescript
// Placeholder array technique
const placeholder = new Array(rawData.length).fill(null);

// Mix actual data with null placeholders
const mergeKData = mergeKArray.reduce((acc, item) => {
  acc[item.id] = item;  // Place data at specific indices
  return acc;
}, placeholder);
```

---

## Chan Theory (缠论) Implementation

### Data Structures

```typescript
interface IFetchK {
  id: number;
  symbol: string;
  time: Date;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

interface IMergeK {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;  // 'up' | 'down' | 'none'
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}

interface IFetchBi {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  type: BiType;  // 'initial' | 'uncomplete' | 'complete'
  independentCount: number;
  originIds: number[];
  originData: IFetchK[];
}

interface IFetchChannel {
  zg: number;           // 中枢上沿（中枢最低的高点）
  zd: number;           // 中枢下沿（中枢最高的低点）
  gg: number;           // 中枢最高（所有笔的最高点）
  dd: number;           // 中枢最低（所有笔的最低点）
  level: ChannelLevel;  // 'bi' | 'duan'
  type: ChannelType;    // 'complete' | 'uncomplete'
  startId: number;
  endId: number;
  trend: TrendDirection;
  bis: IFetchBi[];
}
```

### Visualization Elements

**Merge K (合并K)**: Groups consecutive K-lines based on containment relationships

**Trend Lines (笔)**: Identifies significant price movements

| Type | Color | Description |
|------|-------|-------------|
| Complete | Blue (#2196f3) | Fully formed trend line |
| UnComplete | Purple (#9c27b0) | Incomplete trend line |
| Initial | Orange (#ff9800) | Initial trend line |

**Central Channels (中枢)**: Consolidation zones formed by alternating Bi

| Type | Color | Opacity |
|------|-------|----------|
| Complete | Green (#4caf50) | 15% |
| UnComplete | Orange (#ff9800) | 8% |

**Trend Colors**:
- Up trends: Red (#ef5350)
- Down trends: Teal (#26a69a)

---

## API Integration

### Backend API

The application expects backend API at `NEXT_PUBLIC_API_BASE_URL` (default: `http://127.0.0.1:8008`)

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/indicator/k` | POST | Fetch K-line data |
| `/chan/merge-k` | POST | Calculate Merge K |
| `/chan/bi` | POST | Calculate Trend Lines (Bi) |
| `/chan/channel` | POST | Calculate Channels |

### Configuration

Configure in `app/api/fetch.ts`:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8008';
```

---

## Test Data Management

### Directory Structure

```
mist-fe/test-data/
├── fixtures/              # Static fixtures (local)
│   └── k-line/           # K-line fixtures
└── results/              # From backend sync
    ├── json/             # Raw JSON results
    └── types/            # TypeScript definitions
```

### Sync from Backend

```bash
# Pull latest data from backend
pnpm run sync:from-backend

# Sync + start dev server
pnpm run dev:sync
```

### Usage

```typescript
// Import synced results
import { shanghaiIndex20242025Results } from '@/test-data/results/types';

// Use the data
const kData = shanghaiIndex20242025Results.data.originalKLines;
const summary = shanghaiIndex20242025Results.summary;
```

---

## Configuration

### Environment Variables

Create `.env.local` (see `.env.example`):

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000

# Environment
NODE_ENV=development
```

### TypeScript Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Tailwind CSS v4

Uses new `@import "tailwindcss"` syntax with CSS variables for theming.

---

## Error Handling

### Error Boundaries

The application implements multiple layers of error handling:

1. **API Level**: Try/catch with timeout handling in `fetch.ts`
2. **Component Level**: ErrorBoundary wraps the chart component
3. **User Feedback**: Graceful fallback UIs with retry options

### Error Boundary Location

`app/components/ErrorBoundary.tsx` wraps the main KPanel component.

---

## Development Notes

### Key Route

The `/k` route displays the main K-line chart

### Chart Calculations

Chart calculations (merge K, trend lines) happen client-side in real-time

### Mock Data

For development, the application uses mock data from `app/api/mock-data/`. Configure the active dataset via:

```env
NEXT_PUBLIC_MOCK_DATASET=development  # or 'testing', 'production'
```

---

## Testing

### Test Structure

Unit tests are located alongside source files in `__tests__` directories:

```
app/components/k-panel/
├── utils/
│   └── __tests__/
│       └── dataProcessor.test.ts
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Current Coverage

- Data processing functions: 100% coverage
- 11 passing tests

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.4 | React framework |
| react | 19.2.3 | UI library |
| echarts | 6.0.0 | Charting library |
| tailwindcss | 4.x | Utility-first CSS |
| typescript | 5.9.3 | Type-safe development |
| jest | 30.2.0 | Testing framework |

---

## Known Issues

- Mock data is used in development (backend integration WIP)
- Chart performance may degrade with very large datasets

---

## License

This project is private and proprietary.
