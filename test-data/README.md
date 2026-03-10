# Test Data Directory

This directory contains all test fixtures and test results for the mist-fe frontend project.

## Directory Structure

```
test-data/
├── fixtures/              # Test fixture files
│   ├── k-line/           # K-line chart test data
│   │   ├── csi-300-2023-real.ts
│   │   ├── csi-300-2024-2025-simple.ts
│   │   ├── csi-300-2025-full-year.ts
│   │   └── csi-300-2025-real.ts
│   └── patterns/         # Pattern matching test data (empty, ready for use)
└── results/              # Generated test results
    ├── json/             # JSON test output data (empty, ready for use)
    └── types/            # TypeScript type definitions
        └── index.ts
```

## Fixtures

### K-line Fixtures

Located in `test-data/fixtures/k-line/`, these files contain CSI 300 index data for testing:

- **csi-300-2023-real.ts** - CSI 300 real data from 2023 (21KB)
- **csi-300-2024-2025-simple.ts** - Simplified CSI 300 data spanning 2024-2025 (18KB)
- **csi-300-2025-full-year.ts** - Complete CSI 300 data for 2025 (23KB)
- **csi-300-2025-real.ts** - Real CSI 300 data from 2025 (47KB)

### Pattern Fixtures

Located in `test-data/fixtures/patterns/`, this directory is ready for pattern recognition test data.

## Test Results

The `results/` directory stores generated test output and type definitions:

- **json/** - Directory for JSON test output files (currently empty)
- **types/index.ts** - TypeScript type definitions file for test data types

## Syncing Test Data

Test data can be synced from the backend mist project:

```bash
# Sync test data from backend (runs sync script then starts dev server)
pnpm run dev:sync

# Sync test data from backend (standalone)
pnpm run sync:from-backend
```

This executes the sync script at `scripts/sync-from-backend.js` which copies test data from the backend mist project.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Usage in Tests

Import fixtures in your test files using path aliases:

```typescript
import { csi3002023Real } from '@/test-data/fixtures/k-line/csi-300-2023-real';
import { csi3002024_2025Simple } from '@/test-data/fixtures/k-line/csi-300-2024-2025-simple';
```

## Path Aliases

The test-data directory is configured as a path alias in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@test-data/*": ["test-data/*"]
    }
  }
}
```

This allows importing from the test-data directory using the `@test-data/` prefix.

## Maintenance

When adding new test fixtures:

1. Place fixture files in the appropriate subdirectory under `test-data/fixtures/`
2. Follow the naming convention: `{name}.ts` (e.g., `csi-300-2026-real.ts`)
3. Export the data appropriately from the fixture file
4. Update this README to document new fixtures
5. If needed, add types to `test-data/results/types/index.ts`

## Sync Script

The sync script is located at `scripts/sync-from-backend.js` and handles copying test data from the backend mist project to the frontend test-data directory. It's configured to:

- Read from backend test fixtures
- Transform data if needed
- Output to the appropriate `test-data/fixtures/` subdirectories

## Related Documentation

- [Main README](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - Claude Code instructions
- [Backend Test Data](../../mist/test-data/README.md) - Backend test data documentation (if exists)
