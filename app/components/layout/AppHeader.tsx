"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { formatShanghaiTime } from "@/app/lib/time";

const emptySubscribe = () => () => {};

function subscribeClock(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

function getClockSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getServerClockSeconds() {
  return null;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "组合监控", icon: "📊" },
  { href: "/k", label: "K线看盘", icon: "📈" },
  { href: "/chan", label: "双级别缠论", icon: "⚡" },
  { href: "/strategies", label: "策略工坊", icon: "🧠" },
  { href: "/backtests", label: "回测复盘", icon: "🎯" },
  { href: "/settings/realtime-subscriptions", label: "实时订阅", icon: "📡" },
];

function getMarketTradingStatus(now: Date): { text: string; isOpen: boolean; isWarning?: boolean } {
  const shanghaiHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "numeric", hour12: false }).format(now)
  );
  const shanghaiMin = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", minute: "numeric" }).format(now)
  );
  const shanghaiDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(now);

  const isWeekend = shanghaiDay === "Sat" || shanghaiDay === "Sun";
  if (isWeekend) {
    return { text: "休市 (周末)", isOpen: false };
  }

  const timeMinutes = shanghaiHour * 60 + shanghaiMin;

  if (timeMinutes < 9 * 60 + 15) {
    return { text: "未开盘", isOpen: false };
  } else if (timeMinutes < 9 * 60 + 25) {
    return { text: "盘前集合竞价", isOpen: true, isWarning: true };
  } else if (timeMinutes < 9 * 60 + 30) {
    return { text: "开盘等待", isOpen: false, isWarning: true };
  } else if (timeMinutes <= 11 * 60 + 30) {
    return { text: "连续竞价 (早盘)", isOpen: true };
  } else if (timeMinutes < 13 * 60) {
    return { text: "午间休市", isOpen: false };
  } else if (timeMinutes < 14 * 60 + 57) {
    return { text: "连续竞价 (午盘)", isOpen: true };
  } else if (timeMinutes <= 15 * 60) {
    return { text: "收盘集合竞价", isOpen: true, isWarning: true };
  } else {
    return { text: "已收盘", isOpen: false };
  }
}

export function AppHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const epochSeconds = useSyncExternalStore(subscribeClock, getClockSeconds, getServerClockSeconds);

  const now = epochSeconds ? new Date(epochSeconds * 1000) : null;

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const marketStatus = now ? getMarketTradingStatus(now) : { text: "休市", isOpen: false };

  return (
    <header className="mist-app-header" aria-label="全站导航">
      <div className="header-left">
        <Link href="/k" className="header-logo" title="Mist Institutional Quant Workbench">
          <span className="logo-symbol">◈</span>
          <span className="logo-text">MIST</span>
          <span className="logo-badge">QUANT</span>
        </Link>

        <nav className="header-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="header-right">
        {/* 市场时钟与交易状态 */}
        <div className="market-clock-badge" title="A 股市场交易时间 (Asia/Shanghai)">
          <span
            className={`status-dot ${
              marketStatus.isOpen
                ? marketStatus.isWarning
                  ? "warning"
                  : "open"
                : "closed"
            }`}
            aria-hidden="true"
          />
          <span className="market-status-text">{marketStatus.text}</span>
          <span className="clock-divider" aria-hidden="true">
            |
          </span>
          <span className="clock-time tnum">
            {now ? formatShanghaiTime(now) : "--:--:--"}
          </span>
        </div>

        {/* 主题切换开关 */}
        {mounted && (
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`切换为${isDark ? "浅色" : "深色"}主题`}
            aria-label={`切换为${isDark ? "浅色" : "深色"}主题`}
          >
            {isDark ? "☀️ 浅色" : "🌙 深色"}
          </button>
        )}
      </div>
    </header>
  );
}

export default AppHeader;
