import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ThemeProvider } from "@/app/styles/ThemeProvider";
import { TimeBasedThemeScript } from "@/app/styles/TimeBasedThemeScript";
import { SWRProvider } from "@/app/lib/swr/SWRProvider";
import "./globals.css";
import "@/app/styles/themes.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mist",
  description: "Mist institutional quant workbench",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="light" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <head>
        {/* 防闪烁：hydration 前按时间规则/手动覆盖同步设置 data-theme */}
        <TimeBasedThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AntdRegistry>
          <ThemeProvider>
            <SWRProvider>{children}</SWRProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
