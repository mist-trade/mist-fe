# Mist Frontend (mist-fe)

A sophisticated Next.js application for financial charting and technical analysis, specifically designed for Chinese stock market data visualization. Implements advanced charting capabilities using ECharts with custom Chen Theory (缠论) patterns.

## Features

- **K-line Chart Visualization**: Interactive candlestick charts with volume indicators
- **Merge K (合并K)**: Groups consecutive K-lines based on containment relationships
- **Trend Lines (笔)**: Visualizes significant price movements with color-coded states
- **Real-time Data Processing**: Client-side calculations with streaming support
- **Error Boundaries**: Graceful error handling with fallback UIs
- **Environment Configuration**: Flexible API configuration via environment variables
- **Testing**: Jest-based unit testing with high coverage

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org) | 16.1.4 | React framework with App Router |
| [React](https://react.dev) | 19.2.3 | UI library |
| [TypeScript](https://www.typescriptlang.org) | 5.9.3 | Type-safe development |
| [ECharts](https://echarts.apache.org) | 6.0.0 | Charting library |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | Utility-first CSS |
| [Jest](https://jestjs.io) | 30.2.0 | Testing framework |

## Project Structure

```
app/
├── api/
│   ├── fetch.ts              # API client & data fetching
│   ├── mock-data/
│   │   └── index.ts          # Unified mock data source
│   └── mock-*.ts             # K-line mock datasets
├── components/
│   ├── k-panel/
│   │   ├── index.tsx         # Main K-chart component
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useChartData.ts       # Data processing
│   │   │   ├── useChartConfig.ts     # Chart configuration
│   │   │   └── useChartRender.ts     # ECharts rendering
│   │   ├── utils/            # Utility functions
│   │   │   ├── dataProcessor.ts      # Pure calculation functions
│   │   │   └── formatters.ts         # Data formatting
│   │   ├── config/           # Configuration constants
│   │   │   ├── chartColors.ts        # Color schemes
│   │   │   └── chartOptions.ts       # Chart options
│   │   ├── types/            # TypeScript type definitions
│   │   │   └── index.ts
│   │   ├── __tests__/        # Unit tests
│   │   └── skeleton.tsx      # Loading skeleton
│   └── ErrorBoundary.tsx     # Error boundary component
├── k/
│   └── page.tsx              # K-line chart page
├── layout.tsx                # Root layout
└── globals.css               # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install
```

### Environment Configuration

Create a `.env.local` file (see `.env.example`):

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000

# Environment
NODE_ENV=development
```

### Development

```bash
# Start development server
pnpm dev
```

Visit [http://localhost:3000/k](http://localhost:3000/k) to see the K-line chart.

### Building for Production

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Jest tests once |
| `pnpm test:watch` | Run Jest tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |

## Architecture

### Data Flow

1. Server components fetch initial data via `app/api/fetch.ts`
2. **Promises are passed** (not resolved) to `KPanel` client component
3. Client uses React 19's `use()` hook to unwrap Promises
4. ECharts renders K-lines with custom overlays

This pattern enables streaming and progressive rendering.

### Component Architecture

The KPanel component follows a modular architecture:

```
KPanel (main component)
├── useChartData       - Data processing & transformation
├── useChartConfig     - Chart configuration & series creation
└── useChartRender     - ECharts initialization & updates
```

Each hook has a single responsibility:
- **useChartData**: Processes raw data into chart-ready format
- **useChartConfig**: Creates ECharts configuration and series
- **useChartRender**: Manages ECharts lifecycle

### Chen Theory Implementation

**Merge K (合并K)**: Groups consecutive K-lines based on containment relationships to identify trends and reversals.

**Trend Lines (笔)**: Identifies significant price movements with visual overlays.

| Type | Color | Description |
|------|-------|-------------|
| Complete (完成笔) | Blue (#2196f3) | Fully formed trend line |
| UnComplete (未完成笔) | Purple (#9c27b0) | Incomplete trend line |
| Initial (初始笔) | Orange (#ff9800) | Initial trend line |

**Trend Colors**:
- Up trends: Red (#ef5350)
- Down trends: Teal (#26a69a)

## API Integration

The application expects a backend API at `NEXT_PUBLIC_API_BASE_URL` with the following endpoints:

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/indicator/k` | POST | Fetch K-line data |
| `/chan/merge-k` | POST | Calculate Merge K |
| `/chan/bi` | POST | Calculate Trend Lines (Bi) |

### Request/Response Types

```typescript
// K-line request
interface KRequest {
  symbol: string;    // e.g., "000300"
  code: string;      // e.g., "sh"
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

// K-line response
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
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Test Structure

Unit tests are located alongside source files in `__tests__` directories:

```
app/components/k-panel/
├── utils/
│   └── __tests__/
│       └── dataProcessor.test.ts
```

### Current Coverage

- Data processing functions: 100% coverage
- 11 passing tests

## Error Handling

The application implements multiple layers of error handling:

1. **API Level**: Try/catch with timeout handling in `fetch.ts`
2. **Component Level**: ErrorBoundary wraps the chart component
3. **User Feedback**: Graceful fallback UIs with retry options

## Mock Data

For development, the application uses mock data from `app/api/mock-data/`. Configure the active dataset via:

```env
NEXT_PUBLIC_MOCK_DATASET=development  # or 'testing', 'production'
```

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Run `pnpm lint` before committing
4. Ensure `pnpm test` passes

## License

This project is private and proprietary.

## Support

For issues or questions, please open an issue in the repository.
