# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mist Frontend (mist-fe) - A Next.js application for financial charting and technical analysis, specifically designed for Chinese stock market data visualization. Implements advanced charting capabilities using ECharts with custom Chen Theory (缠论) patterns.

## Development Commands

```bash
# Development
pnpm dev             # Start development server on http://localhost:3000

# Production
pnpm build           # Build for production
pnpm start           # Start production server

# Code Quality
pnpm lint            # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16.1.4 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19.2.3
- **Charting**: ECharts 6.0.0
- **Styling**: Tailwind CSS 4 (postcss-based)

## Architecture

### App Router Structure

```
app/
├── api/               # API routes & mock data
│   ├── fetch.ts       # API client & data fetching
│   └── mock*.ts       # K-line mock datasets (CSI 300)
├── components/
│   └── k-panel/       # Main K-chart component
│       ├── index.tsx  # K-line chart with ECharts
│       └── skeleton.tsx
├── k/page.tsx         # K-line chart page route
├── layout.tsx         # Root layout
└── globals.css        # Tailwind v4 global styles
```

### Data Flow

1. Server components fetch initial data via `app/api/fetch.ts`
2. **Promises are passed** to `KPanel` client component (not resolved data)
3. Client uses React 19's `use()` hook to unwrap Promises
4. ECharts renders K-lines with custom overlays (merge K, trend lines)

**Key Pattern**: Passing unresolved Promises from server to client components enables streaming and progressive rendering. The `use()` hook suspends the component until data is available.

### Chart Architecture (app/components/k-panel/index.tsx)

The K-panel implements a sophisticated charting system with:

- **Custom ECharts Series**: Uses `custom` series type for overlay graphics (merge K rectangles, trend lines)
- **Placeholder Arrays**: Efficient mapping between data layers - creates placeholder items for overlay positioning
- **Multi-layered Rendering**:
  - K-line candlesticks (base data)
  - Merge K (合并K) - translucent rectangles grouping consecutive K-lines based on containment relationships
  - Trend lines (笔) - lines showing significant price movements, classified as complete/incomplete/initial
- **Color Coding**: Different colors for trend directions (up/down) and states

Key implementation patterns:
```typescript
// Custom series rendering with placeholder arrays
const placeholder = new Array(rawData.length).fill(null);
// Mix actual data with null placeholders for correct positioning
const mergeKData = mergeKArray.reduce((acc, item) => {
  acc[item.id] = item;  // Place data at specific indices
  return acc;
}, placeholder);
```

### Chen Theory (缠论) Implementation

**Merge K (合并K)**: Groups consecutive K-lines based on containment relationships to identify trends and reversals.

**Trend Lines (笔)**: Identifies significant price movements with visual overlays. Classified as:
- Complete (`BiType.Complete`) - blue (`#2196f3`)
- UnComplete (`BiType.UnComplete`) - purple (`#9c27b0`)

**Color Scheme**:
- Up trends: red (`#ef5350`)
- Down trends: teal (`#26a69a`)

## Data Structures

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
  startId: number;      // 起始的K线索引
  endId: number;        // 结束的K线索引
  trend: TrendDirection;
  bis: IFetchBi[];      // 组成中枢的笔数组
}

enum ChannelLevel {
  Bi = 'bi',      // 笔级别
  Duan = 'duan',  // 段级别
}

enum ChannelType {
  Complete = 'complete',       // 完成中枢
  UnComplete = 'uncomplete',   // 未完成中枢
}
```

### Chen Theory (缠论) Implementation

**Merge K (合并K)**: Groups consecutive K-lines based on containment relationships to identify trends and reversals.

**Trend Lines (笔)**: Identifies significant price movements with visual overlays. Classified as:
- Complete (`BiType.Complete`) - blue (`#2196f3`)
- UnComplete (`BiType.UnComplete`) - purple (`#9c27b0`)

**Central Channels (中枢)**: Identifies consolidation zones formed by alternating Bi (笔). A channel requires at least 5 Bi with price overlap. Classified as:
- Complete - green (`#4caf50`), 15% opacity fill
- UnComplete - orange (`#ff9800`), 8% opacity fill

**Color Scheme**:
- Up trends: red (`#ef5350`)
- Down trends: teal (`#26a69a`)
- Channel complete: green (`#4caf50`)
- Channel uncomplete: orange (`#ff9800`)

### Visualization Layers (z-index)

```
K-line (candlestick):  z=0
Volume:                z=1
Channel:               z=3  ← NEW
Merge K:               z=5
Bi (trend lines):      z=10
```

Channels are rendered as multi-layered rectangles with:
- **Fill rectangle**: Shows overall channel range (dd to gg)
- **Upper edge line (zg)**: Dashed line at channel's upper edge (lowest high)
- **Lower edge line (zd)**: Dashed line at channel's lower edge (highest low)
- **Border rectangle**: Dashed outline for visual clarity

## Configuration

- **Tailwind CSS v4**: Uses new `@import "tailwindcss"` syntax with CSS variables for theming
- **TypeScript Path Aliases**: `"@/*": ["./*"]` configured in tsconfig.json
- **Chart Renderer**: Canvas renderer for performance
- **Base URL**: Configured in `app/api/fetch.ts`

## Development Notes

- The `/k` route displays the main K-line chart
- Chart calculations (merge K, trend lines) happen client-side in real-time
- API calls in `fetch.ts` make HTTP requests but return mock data for development

## Test Data Management

### Directory Structure

```
mist-fe/test-data/
├── fixtures/           # Test input data (synced from backend)
│   ├── k-line/         # K-line raw data
│   └── patterns/       # Test pattern data
└── results/            # Test output (synced from backend)
    ├── json/           # JSON results
    └── types/          # TypeScript definitions
```

### Synchronization

Test data is synced from the backend:
```bash
# From backend directory
cd ../mist
pnpm run test:sync     # Sync test results to frontend
```

### Usage in Development

When developing visualizations, you can use the synced test data:
- Import from `@/test-data/fixtures` for test inputs
- Import from `@/test-data/results` for expected outputs
- Type definitions are auto-generated and available in `test-data/results/types/`

## API Integration

The backend API (`http://127.0.0.1:8008`) is expected to provide endpoints:
- `/indicator/k` - K-line data
- `/chan/merge-k` - Merge K calculations
- `/chan/bi` - Trend line (Bi) calculations

Currently, the frontend makes fetch requests but resolves with mock data. To connect to a real backend, modify the `.then()` handlers in `fetch.ts` to return actual response data.
