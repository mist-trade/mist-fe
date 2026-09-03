import type { Metadata } from "next";
import DualTimeframeChanPage from "./DualTimeframeChanPage";

export const metadata: Metadata = {
  title: "多周期缠论工作台 · Mist",
  description: "双周期分屏联动视角：30 分钟大级别大局观 + 5 分钟微观结构中枢放大镜",
};

export default function ChanPage() {
  return <DualTimeframeChanPage />;
}
