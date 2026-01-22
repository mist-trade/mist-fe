export default function KPanelSkeleton() {
  return (
    <div className="w-full h-[600px] bg-background p-4 animate-pulse">
      {/* 标题骨架 */}
      <div className="h-8 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>

      {/* 主图表区域骨架 */}
      <div className="w-full h-[300px] bg-gray-200 dark:bg-gray-800 rounded-lg mb-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent animate-shimmer"></div>
      </div>

      {/* 副图表区域骨架 */}
      <div className="w-full h-[100px] bg-gray-200 dark:bg-gray-800 rounded-lg mb-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent animate-shimmer"></div>
      </div>

      {/* 滑块控制区域骨架 */}
      <div className="w-full h-[50px] bg-gray-200 dark:bg-gray-800 rounded relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent animate-shimmer"></div>
      </div>
    </div>
  );
}
