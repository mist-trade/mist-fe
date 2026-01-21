import { fetchK } from "@/app/api/fetch";
import { Suspense } from "react";

export default async function K() {
  const data = fetchK({
    symbol: "000300",
    code: "sh",
    startDate: "2024-09-23",
    endDate: "2025-02-21",
  });

  return <Suspense fallback={<div>Loading...</div>}></Suspense>;
}
