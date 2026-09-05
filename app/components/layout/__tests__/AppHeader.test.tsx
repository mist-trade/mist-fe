import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "../AppHeader";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next-themes", () => ({
  useTheme: jest.fn(),
}));

describe("AppHeader", () => {
  const mockSetTheme = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/backtests");
    (useTheme as jest.Mock).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
    });
  });

  it("renders Mist logo and quant brand badge", () => {
    render(<AppHeader />);
    expect(screen.getByText("MIST")).toBeInTheDocument();
    expect(screen.getByText("QUANT")).toBeInTheDocument();
  });

  it("renders all 6 core navigation links", () => {
    render(<AppHeader />);
    const links = [
      { name: /组合监控/i, href: "/dashboard" },
      { name: /K线看盘/i, href: "/k" },
      { name: /双级别缠论/i, href: "/chan" },
      { name: /策略工坊/i, href: "/strategies" },
      { name: /回测复盘/i, href: "/backtests" },
      { name: /实时订阅/i, href: "/settings/realtime-subscriptions" },
    ];

    for (const item of links) {
      const link = screen.getByRole("link", { name: item.name });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("highlights the currently active route", () => {
    (usePathname as jest.Mock).mockReturnValue("/backtests");
    render(<AppHeader />);

    const backtestLink = screen.getByRole("link", { name: /回测复盘/i });
    expect(backtestLink).toHaveClass("active");
    expect(backtestLink).toHaveAttribute("aria-current", "page");

    const klineLink = screen.getByRole("link", { name: /K线看盘/i });
    expect(klineLink).not.toHaveClass("active");
    expect(klineLink).not.toHaveAttribute("aria-current");
  });

  it("renders market clock and Shanghai timezone status", () => {
    render(<AppHeader />);
    const clockBadge = screen.getByTitle(/A 股市场交易时间/i);
    expect(clockBadge).toBeInTheDocument();
  });

  it("toggles theme between light and dark when theme button is clicked", () => {
    render(<AppHeader />);
    const toggleBtn = screen.getByRole("button", { name: /切换为浅色主题/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
