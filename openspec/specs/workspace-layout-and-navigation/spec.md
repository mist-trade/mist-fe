# workspace-layout-and-navigation Specification

## Purpose
Enforce a unified institutional workbench layout and global top navigation across all frontend views.

## Requirements
### Requirement: Global Unified Navigation
The web frontend SHALL provide a single, persistent top navigation header (`AppHeader`) in `app/layout.tsx` across all application routes.

#### Scenario: User visits any route
- **WHEN** a user visits any page in the application (`/dashboard`, `/k`, `/chan`, `/strategies`, `/backtests`, `/settings/realtime-subscriptions`)
- **THEN** the system MUST display the global navigation header with:
  1. The Mist platform logo and title;
  2. Complete navigation links for all six primary views with active-route highlighting (`aria-current="page"`);
  3. Realtime Shanghai market trading status clock;
  4. Global theme toggle switcher.

### Requirement: Elimination of Page-private Headers
Individual view components SHALL NOT render their own private top navigation headers.

#### Scenario: View rendering inside application shell
- **WHEN** a view is rendered within the application shell
- **THEN** it MUST rely on the global `AppHeader` for primary navigation and SHALL NOT render redundant `<header className="kline-header">` or `<header className="strategy-header">` blocks.

### Requirement: Standard Workspace Layout Axiom
Trading and analysis views (`/backtests`, `/k`, `/chan`, `/strategies`) SHALL adopt the standard two-column `WorkspaceShell` layout.

#### Scenario: Accessing operational workspace views
- **WHEN** a user accesses an operational workspace view
- **THEN** the layout MUST position input selection, configuration forms, and target lists in the **left sidebar** (width 280px–340px) and the primary visualization canvas, toolbars, and inspection tables in the **right main panel**.

### Requirement: Collapsible Workspace Sidebar
The workspace sidebar SHALL support interactive collapsing and expansion.

#### Scenario: Collapsing or expanding the sidebar
- **WHEN** a user triggers the sidebar toggle button (`◀` / `▶`)
- **THEN** the left sidebar MUST collapse to a compact state (width <= 48px) and the right main panel MUST smoothly expand to fill the remaining viewport width, with the underlying charts adapting to the new width without overflow.
