import ErrorBoundary from "@/app/components/ErrorBoundary";
import KLineLivePage from "./KLineLivePage";

export default function K() {
  return (
    <ErrorBoundary>
      <KLineLivePage />
    </ErrorBoundary>
  );
}
