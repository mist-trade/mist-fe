import { calculateChannelData, createChannelPlaceholders } from '../utils/dataProcessor';
import { ChannelLevel, ChannelType, TrendDirection, BiType, BiStatus } from '@/app/api/fetch';
import type { IFetchK, IFetchChannel, IFetchBi } from '@/app/api/fetch';
import type { BiMappedData } from '../types';
import { getChannelColor, hexToRgba } from '../config/chartColors';

describe('Channel Data Processing', () => {
  const mockK: IFetchK[] = [
    { id: 1, symbol: '000300', time: new Date('2024-01-01'), amount: 1000, open: 100, close: 105, highest: 110, lowest: 95 },
    { id: 2, symbol: '000300', time: new Date('2024-01-02'), amount: 1200, open: 105, close: 108, highest: 112, lowest: 103 },
    { id: 3, symbol: '000300', time: new Date('2024-01-03'), amount: 1100, open: 108, close: 102, highest: 115, lowest: 100 },
    { id: 4, symbol: '000300', time: new Date('2024-01-04'), amount: 1300, open: 102, close: 107, highest: 110, lowest: 101 },
    { id: 5, symbol: '000300', time: new Date('2024-01-05'), amount: 1400, open: 107, close: 112, highest: 115, lowest: 106 },
    { id: 6, symbol: '000300', time: new Date('2024-01-06'), amount: 1500, open: 112, close: 109, highest: 118, lowest: 108 },
    { id: 7, symbol: '000300', time: new Date('2024-01-07'), amount: 1600, open: 109, close: 111, highest: 113, lowest: 107 },
    { id: 8, symbol: '000300', time: new Date('2024-01-08'), amount: 1700, open: 111, close: 114, highest: 116, lowest: 110 },
    { id: 9, symbol: '000300', time: new Date('2024-01-09'), amount: 1800, open: 114, close: 117, highest: 120, lowest: 113 },
    { id: 10, symbol: '000300', time: new Date('2024-01-10'), amount: 1900, open: 117, close: 115, highest: 122, lowest: 114 },
  ];

  const mockBiMappedData: BiMappedData[] = [
    {
      startIndex: 0,
      endIndex: 2,
      startPrice: 95,
      endPrice: 115,
      trend: TrendDirection.Up,
      type: BiType.Complete,
      status: BiStatus.Valid,
      independentCount: 3,
      originData: [mockK[0], mockK[1], mockK[2]],
      highest: 115,
      lowest: 95,
      biId: 0,
    },
    {
      startIndex: 2,
      endIndex: 4,
      startPrice: 115,
      endPrice: 101,
      trend: TrendDirection.Down,
      type: BiType.Complete,
      status: BiStatus.Valid,
      independentCount: 3,
      originData: [mockK[2], mockK[3], mockK[4]],
      highest: 115,
      lowest: 101,
      biId: 1,
    },
    {
      startIndex: 4,
      endIndex: 6,
      startPrice: 106,
      endPrice: 118,
      trend: TrendDirection.Up,
      type: BiType.Complete,
      status: BiStatus.Valid,
      independentCount: 3,
      originData: [mockK[4], mockK[5], mockK[6]],
      highest: 118,
      lowest: 106,
      biId: 2,
    },
    {
      startIndex: 6,
      endIndex: 8,
      startPrice: 107,
      endPrice: 120,
      trend: TrendDirection.Down,
      type: BiType.Complete,
      status: BiStatus.Valid,
      independentCount: 3,
      originData: [mockK[6], mockK[7], mockK[8]],
      highest: 120,
      lowest: 107,
      biId: 3,
    },
  ];

  const mockChannel: IFetchChannel[] = [
    {
      zg: 118,
      zd: 107,
      gg: 120,
      dd: 100,
      level: ChannelLevel.Bi,
      type: ChannelType.Complete,
      startId: 1,
      endId: 9,
      trend: TrendDirection.Up,
      bis: [] as IFetchBi[], // Would be full IFetchBi[] in real scenario
    },
  ];

  describe('calculateChannelData', () => {
    it('should calculate channel data correctly', () => {
      const result = calculateChannelData(mockK, mockChannel, mockBiMappedData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        channelId: 0,
        startIndex: 0,  // id=1 is at index 0
        endIndex: 8,   // id=9 is at index 8
        zg: 118,
        zd: 107,
        gg: 120,
        dd: 100,
        trend: TrendDirection.Up,
        type: ChannelType.Complete,
        level: ChannelLevel.Bi,
      });
    });

    it('should handle empty data gracefully', () => {
      const result = calculateChannelData([], [], []);
      expect(result).toEqual([]);
    });

    it('should filter channels with invalid indices', () => {
      const invalidChannel: IFetchChannel[] = [
        {
          zg: 100,
          zd: 90,
          gg: 110,
          dd: 85,
          level: ChannelLevel.Bi,
          type: ChannelType.Complete,
          startId: 999,  // Non-existent ID
          endId: 1000,
          trend: TrendDirection.Up,
          bis: [],
        },
      ];
      const result = calculateChannelData(mockK, invalidChannel, []);
      expect(result).toHaveLength(0);
    });

    it('should handle channels with reversed indices', () => {
      const reversedChannel: IFetchChannel[] = [
        {
          zg: 100,
          zd: 90,
          gg: 110,
          dd: 85,
          level: ChannelLevel.Bi,
          type: ChannelType.Complete,
          startId: 9,  // Higher ID
          endId: 1,   // Lower ID (should be filtered out)
          trend: TrendDirection.Up,
          bis: [],
        },
      ];
      const result = calculateChannelData(mockK, reversedChannel, []);
      expect(result).toHaveLength(0);
    });

    it('should link Bi data correctly', () => {
      // Create channel with Bi data
      const channelWithBi: IFetchChannel[] = [
        {
          ...mockChannel[0],
          bis: mockBiMappedData.map(bi => ({
            startTime: mockK[bi.startIndex].time,
            endTime: mockK[bi.endIndex].time,
            highest: bi.highest,
            lowest: bi.lowest,
            trend: bi.trend,
            type: bi.type,
            status: bi.status,
            independentCount: bi.independentCount,
            originIds: [bi.startIndex + 1, bi.endIndex + 1],
            originData: bi.originData,
            startFenxing: null,
            endFenxing: null,
          })),
        },
      ];

      const result = calculateChannelData(mockK, channelWithBi, mockBiMappedData);
      expect(result[0].bis).toHaveLength(mockBiMappedData.length);
    });

    it('should handle multiple channels', () => {
      const multipleChannels: IFetchChannel[] = [
        {
          zg: 105,
          zd: 102,
          gg: 110,
          dd: 100,
          level: ChannelLevel.Bi,
          type: ChannelType.Complete,
          startId: 1,
          endId: 5,
          trend: TrendDirection.Up,
          bis: [],
        },
        {
          zg: 115,
          zd: 110,
          gg: 120,
          dd: 107,
          level: ChannelLevel.Bi,
          type: ChannelType.UnComplete,
          startId: 6,
          endId: 10,
          trend: TrendDirection.Down,
          bis: [],
        },
      ];

      const result = calculateChannelData(mockK, multipleChannels, []);
      expect(result).toHaveLength(2);
      expect(result[0].channelId).toBe(0);
      expect(result[1].channelId).toBe(1);
      expect(result[0].type).toBe(ChannelType.Complete);
      expect(result[1].type).toBe(ChannelType.UnComplete);
    });
  });

  describe('createChannelPlaceholders', () => {
    const channelData = [
      {
        channelId: 0,
        startIndex: 0,
        endIndex: 4,
        zg: 118,
        zd: 107,
        gg: 120,
        dd: 100,
        trend: TrendDirection.Up,
        type: ChannelType.Complete,
        level: ChannelLevel.Bi,
        bis: [],
      },
      {
        channelId: 1,
        startIndex: 5,
        endIndex: 9,
        zg: 116,
        zd: 110,
        gg: 122,
        dd: 108,
        trend: TrendDirection.Down,
        type: ChannelType.UnComplete,
        level: ChannelLevel.Bi,
        bis: [],
      },
    ];

    it('should create placeholder array with channelIds at start positions', () => {
      const result = createChannelPlaceholders(channelData, 10);

      expect(result).toHaveLength(10);
      expect(result[0]).toBe(0);  // First channel starts at index 0
      expect(result[5]).toBe(1);  // Second channel starts at index 5
      expect(result[1]).toBeNull();
      expect(result[6]).toBeNull();
    });

    it('should handle empty channel data', () => {
      const result = createChannelPlaceholders([], 10);
      expect(result).toHaveLength(10);
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should handle out-of-bounds indices', () => {
      const outOfBoundsData = [
        {
          ...channelData[0],
          startIndex: -1,  // Invalid
        },
      ];
      const result = createChannelPlaceholders(outOfBoundsData, 10);
      // Should not place anything for invalid index
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should handle index equal to array length', () => {
      const exactLengthData = [
        {
          ...channelData[0],
          startIndex: 10,  // Equal to length
        },
      ];
      const result = createChannelPlaceholders(exactLengthData, 10);
      // Should not place anything (out of bounds)
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should handle overlapping channels', () => {
      const overlappingData = [
        {
          channelId: 0,
          startIndex: 0,
          endIndex: 5,
          zg: 110,
          zd: 105,
          gg: 115,
          dd: 100,
          trend: TrendDirection.Up,
          type: ChannelType.Complete,
          level: ChannelLevel.Bi,
          bis: [],
        },
        {
          channelId: 1,
          startIndex: 3,  // Overlaps with first channel
          endIndex: 7,
          zg: 112,
          zd: 107,
          gg: 118,
          dd: 102,
          trend: TrendDirection.Down,
          type: ChannelType.UnComplete,
          level: ChannelLevel.Bi,
          bis: [],
        },
      ];

      const result = createChannelPlaceholders(overlappingData, 10);
      expect(result[0]).toBe(0);
      expect(result[3]).toBe(1);
      // Both should be placed even if they overlap
    });
  });

  describe('Integration with existing data', () => {
    it('should not interfere with MergeK and Bi placeholders', () => {
      const channelData = [
        {
          channelId: 0,
          startIndex: 0,
          endIndex: 4,
          zg: 118,
          zd: 107,
          gg: 120,
          dd: 100,
          trend: TrendDirection.Up,
          type: ChannelType.Complete,
          level: ChannelLevel.Bi,
          bis: [],
        },
        {
          channelId: 1,
          startIndex: 5,
          endIndex: 9,
          zg: 116,
          zd: 110,
          gg: 122,
          dd: 108,
          trend: TrendDirection.Down,
          type: ChannelType.UnComplete,
          level: ChannelLevel.Bi,
          bis: [],
        },
      ];

      const channelPlaceholders = createChannelPlaceholders(channelData, 10);

      // Verify positions are distinct or null
      const nonNullIndices = channelPlaceholders
        .map((val, idx) => val !== null ? idx : -1)
        .filter(idx => idx !== -1);

      expect(nonNullIndices).toEqual([0, 5]);
    });
  });

  describe('Channel color updates', () => {
    it('should return "#00e676" for Complete channel type', () => {
      const color = getChannelColor(ChannelType.Complete);
      expect(color).toBe('#00e676');
    });

    it('should return "#ffab00" for UnComplete channel type', () => {
      const color = getChannelColor(ChannelType.UnComplete);
      expect(color).toBe('#ffab00');
    });

    it('should convert "#00e676" with 0.20 opacity to rgba', () => {
      const rgba = hexToRgba('#00e676', 0.20);
      expect(rgba).toBe('rgba(0, 230, 118, 0.2)');
    });

    it('should convert "#ffab00" with 0.12 opacity to rgba', () => {
      const rgba = hexToRgba('#ffab00', 0.12);
      expect(rgba).toBe('rgba(255, 171, 0, 0.12)');
    });
  });
});
