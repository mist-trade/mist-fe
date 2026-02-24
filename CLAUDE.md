# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mist Frontend (mist-fe) - A Next.js application for financial charting and technical analysis, specifically designed for Chinese stock market data visualization. Implements advanced charting capabilities using ECharts with custom Chen Theory (缠论) patterns.

## Development Commands

```bash
# Development
npm run dev          # Start development server on http://localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
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
2. Data flows to `KPanel` client component
3. ECharts renders K-lines with custom overlays (merge K, trend lines)

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
- Complete (solid lines)
- Incomplete (dashed lines)
- Initial (special marking)

Color-coded by trend direction and type.

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
  trend: TrendDirection;  // 'up' | 'down' | 'flat'
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}
```

## Configuration

- **Tailwind CSS v4**: Uses new `@import "tailwindcss"` syntax with CSS variables for theming
- **TypeScript Path Aliases**: `"@/*": ["./*"]` configured in tsconfig.json
- **Chart Renderer**: Canvas renderer for performance
- **Base URL**: Configured in `app/api/fetch.ts`

## Development Notes

- The `/k` route displays the main K-line chart
- Mock data files in `app/api/` simulate CSI 300 index data for development
- Chart calculations (merge K, trend lines) happen client-side in real-time
- Recent development focus: fixing chart rendering issues and Chen Theory pattern implementation
