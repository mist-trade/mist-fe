'use client';

import React, { useState } from 'react';
import { TestStatistics, ChannelDetail } from '@/app/api/types/test-statistics.types';

interface TestStatisticsPanelProps {
  statistics: TestStatistics;
}

/**
 * Statistics panel for displaying Chan algorithm test results
 * Shows market data, Bi statistics, and Channel information
 */
export default function TestStatisticsPanel({ statistics }: TestStatisticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bi' | 'channels'>('overview');

  const formatPercent = (val: number | undefined): string => {
    if (val === undefined) return 'N/A';
    return `${val.toFixed(2)}%`;
  };
  const formatPrice = (val: number | undefined): string => {
    if (val === undefined) return 'N/A';
    return val.toFixed(2);
  };

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[90vh] overflow-auto bg-black/80 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 text-white z-50">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Chan Algorithm Test Results</h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>

        {/* Tabs */}
        {isExpanded && (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('bi')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'bi'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Bi (笔)
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'channels'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Channels (中枢)
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Metadata */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Test Metadata</h3>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Source:</span>
                    <span className="text-right">{statistics.metadata?.dataSource || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Date Range:</span>
                    <span className="text-right">{statistics.metadata?.dateRange || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Market Stats */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Market Statistics</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Highest:</span>
                    <span className="text-green-400">{formatPrice(statistics.marketStats?.highest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lowest:</span>
                    <span className="text-red-400">{formatPrice(statistics.marketStats?.lowest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">2024 Return:</span>
                    <span className={(statistics.marketStats?.yearReturn2024 ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}>
                      {(statistics.marketStats?.yearReturn2024 ?? 0) >= 0 ? '+' : ''}
                      {formatPercent(statistics.marketStats?.yearReturn2024)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">2024 Start:</span>
                    <span>{formatPrice(statistics.marketStats?.yearStart2024)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">2024 End:</span>
                    <span>{formatPrice(statistics.marketStats?.yearEnd2024)}</span>
                  </div>
                </div>
              </div>

              {/* Data Stats */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Data Statistics</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total K-Lines:</span>
                    <span>{statistics.dataStats?.totalKLines ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Merge K-Lines:</span>
                    <span>{statistics.dataStats?.totalMergeK ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Merge Ratio:</span>
                    <span>{statistics.dataStats?.mergeRatio?.toFixed(2) || 'N/A'}x</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{statistics.dataStats?.dataBreakdown || ''}</div>
                </div>
              </div>
            </>
          )}

          {/* Bi Tab */}
          {activeTab === 'bi' && (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Bi (笔) Statistics</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Bis:</span>
                    <span className="font-semibold">{statistics.biStats?.total ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Complete:</span>
                    <span className="text-blue-400">{statistics.biStats?.complete ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uncomplete:</span>
                    <span className="text-purple-400">{statistics.biStats?.uncomplete ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Up (上):</span>
                    <span className="text-red-400">{statistics.biStats?.up ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Down (下):</span>
                    <span className="text-teal-400">{statistics.biStats?.down ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Duration Statistics</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Duration:</span>
                    <span>{statistics.biStats?.avgDuration?.toFixed(2) || 'N/A'} K-lines</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Duration:</span>
                    <span>{statistics.biStats?.maxDuration ?? 'N/A'} K-lines</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min Duration:</span>
                    <span>{statistics.biStats?.minDuration ?? 'N/A'} K-lines</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-800/50 rounded">
                <div className="text-xs text-gray-400 mb-2">Up/Down Ratio</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{
                        width: `${((statistics.biStats?.up ?? 0) / (statistics.biStats?.total ?? 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {statistics.biStats?.up ?? 0}:{statistics.biStats?.down ?? 0}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-400">Channel (中枢) Statistics</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Channels:</span>
                    <span className="font-semibold">{statistics.channelStats?.total ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Complete:</span>
                    <span className="text-green-400">{statistics.channelStats?.complete ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uncomplete:</span>
                    <span className="text-orange-400">{statistics.channelStats?.uncomplete ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              {(statistics.channelStats?.channels?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400">Channel Details</h3>
                  {statistics.channelStats?.channels?.map((channel: ChannelDetail) => (
                    <div key={channel.index} className="p-3 bg-gray-800/50 rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Channel {channel.index}</span>
                        <span className="text-xs text-gray-400">{channel.biCount} Bi</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">ZG (中枢高):</span>{' '}
                          <span className="text-yellow-400">{formatPrice(channel.priceRange.zg)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">ZD (中枢低):</span>{' '}
                          <span className="text-blue-400">{formatPrice(channel.priceRange.zd)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">GG (最高):</span>{' '}
                          <span className="text-green-400">{formatPrice(channel.fullRange.gg)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">DD (最低):</span>{' '}
                          <span className="text-red-400">{formatPrice(channel.fullRange.dd)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Width:</span>
                        <span>
                          {formatPrice(channel.width)} ({formatPercent(channel.widthPercent)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {statistics.channelStats.channels.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  No channels identified in this dataset
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
