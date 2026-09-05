import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceShell } from "../WorkspaceShell";

describe("WorkspaceShell", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("renders sidebar content, sidebar title and main content", () => {
    render(
      <WorkspaceShell
        sidebarTitle="回测配置与历史"
        sidebar={<div data-testid="sidebar-content">Sidebar Body</div>}
      >
        <div data-testid="main-content">Main Canvas</div>
      </WorkspaceShell>
    );

    expect(screen.getByText("回测配置与历史")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
    expect(screen.getByTestId("main-content")).toBeInTheDocument();
  });

  it("toggles collapse state when toggle button is clicked", () => {
    render(
      <WorkspaceShell
        sidebarTitle="回测配置与历史"
        sidebar={<div data-testid="sidebar-content">Sidebar Body</div>}
      >
        <div data-testid="main-content">Main Canvas</div>
      </WorkspaceShell>
    );

    const toggleBtn = screen.getByRole("button", { name: "收起侧栏" });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Click collapse
    fireEvent.click(toggleBtn);
    expect(screen.getByRole("button", { name: "展开侧栏" })).toHaveAttribute("aria-expanded", "false");

    // When collapsed, the sidebar hint is visible and clicking it expands
    const hint = screen.getByTestId("workspace-sidebar-collapsed-hint");
    fireEvent.click(hint);
    expect(screen.getByRole("button", { name: "收起侧栏" })).toHaveAttribute("aria-expanded", "true");
  });

  it("persists collapsed state to localStorage when storageKey is provided", () => {
    const storageKey = "mist_test_sidebar_state";

    const { unmount } = render(
      <WorkspaceShell
        storageKey={storageKey}
        sidebarTitle="配置"
        sidebar={<div>Body</div>}
      >
        <div>Content</div>
      </WorkspaceShell>
    );

    const toggleBtn = screen.getByRole("button", { name: "收起侧栏" });
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem(storageKey)).toBe("true");

    unmount();

    // Re-mount should restore collapsed state from localStorage
    render(
      <WorkspaceShell
        storageKey={storageKey}
        sidebarTitle="配置"
        sidebar={<div>Body</div>}
      >
        <div>Content</div>
      </WorkspaceShell>
    );

    expect(screen.getByRole("button", { name: "展开侧栏" })).toHaveAttribute("aria-expanded", "false");
  });

  it("applies custom sidebarWidth when specified", () => {
    render(
      <WorkspaceShell
        sidebarWidth={380}
        sidebar={<div>Custom Width Sidebar</div>}
      >
        <div>Main Area</div>
      </WorkspaceShell>
    );

    const aside = screen.getByRole("complementary", { name: "工作台侧边栏" });
    expect(aside).toHaveStyle({ width: "380px" });
  });
});
