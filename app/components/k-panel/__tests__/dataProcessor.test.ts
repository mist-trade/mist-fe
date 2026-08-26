import {
  buildKLineIndexes,
  calculateMergeKRects,
  calculateBiData,
  createMergeKPlaceholders,
  createBiPlaceholders,
  calculateDuanData,
  createDuanPlaceholders,
  calculateDuanChannelData,
  createDuanChannelPlaceholders,
  calculateBspData,
  createBspPlaceholders,
  calculateMacd,
} from '../utils/dataProcessor';
import { TrendDirection, BiType, BiStatus, DuanType, DuanStatus, ChannelLevel, ChannelType } from '@/app/api/types';
import type { IFetchK, IMergeK, IFetchBi, IFetchDuan, IFetchDuanChannel } from '@/app/api/types';

describe('DataProcessor', () => {
  const mockK: IFetchK[] = [
    { id: 1, symbol: '000300', time: new Date('2024-01-01'), amount: 1000, open: 100, close: 105, high: 110, low: 95 },
    { id: 2, symbol: '000300', time: new Date('2024-01-02'), amount: 1200, open: 105, close: 108, high: 112, low: 103 },
    { id: 3, symbol: '000300', time: new Date('2024-01-03'), amount: 1100, open: 108, close: 102, high: 115, low: 100 },
    { id: 4, symbol: '000300', time: new Date('2024-01-04'), amount: 1300, open: 102, close: 107, high: 110, low: 101 },
    { id: 5, symbol: '000300', time: new Date('2024-01-05'), amount: 1400, open: 107, close: 112, high: 115, low: 106 },
  ];

  const mockMergeK: IMergeK[] = [
    { startTime: new Date('2024-01-01'), endTime: new Date('2024-01-02'), high: 115, low: 95, trend: TrendDirection.Up, mergedCount: 2, mergedIds: [1, 2], mergedData: [mockK[0], mockK[1]] },
    { startTime: new Date('2024-01-03'), endTime: new Date('2024-01-04'), high: 110, low: 100, trend: TrendDirection.Down, mergedCount: 2, mergedIds: [3, 4], mergedData: [mockK[2], mockK[3]] },
  ];

  const mockBi: IFetchBi[] = [
    { startTime: new Date('2024-01-01'), endTime: new Date('2024-01-03'), high: 110, low: 95, trend: TrendDirection.Up, type: BiType.Complete, status: BiStatus.Valid, independentCount: 3, originIds: [1, 2, 3], originData: [mockK[0], mockK[1], mockK[2]], startFenxing: null, endFenxing: null },
    { startTime: new Date('2024-01-03'), endTime: new Date('2024-01-05'), high: 115, low: 100, trend: TrendDirection.Down, type: BiType.UnComplete, status: BiStatus.Unknown, independentCount: 3, originIds: [3, 4, 5], originData: [mockK[2], mockK[3], mockK[4]], startFenxing: null, endFenxing: null },
  ];

  describe('calculateMergeKRects', () => {
    it('should calculate merge K rectangles correctly', () => {
      const result = calculateMergeKRects(mockK, mockMergeK);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        startIndex: 0,
        endIndex: 1,
        high: 115,
        low: 95,
        trend: TrendDirection.Up,
        rectId: 0,
      });
      expect(result[1]).toMatchObject({
        startIndex: 2,
        endIndex: 3,
        high: 110,
        low: 100,
        trend: TrendDirection.Down,
        rectId: 1,
      });
    });

    it('should handle empty data gracefully', () => {
      const result = calculateMergeKRects([], []);
      expect(result).toEqual([]);
    });

    it('should handle K data with no merge K data', () => {
      const result = calculateMergeKRects(mockK, []);
      expect(result).toEqual([]);
    });

    it('should expose reusable timestamp and id indexes for large datasets', () => {
      const indexes = buildKLineIndexes(mockK);

      expect(indexes.byId.get(3)).toBe(2);
      expect(indexes.byTime.get(new Date('2024-01-04').getTime())).toBe(3);
    });
  });

  describe('calculateBiData', () => {
    it('should calculate Bi data correctly', () => {
      const result = calculateBiData(mockK, mockBi);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        startIndex: 0,
        endIndex: 2,
        startPrice: 95, // low for Up trend
        endPrice: 110, // high for Up trend
        trend: TrendDirection.Up,
        type: BiType.Complete,
        biId: 0,
      });
    });

    it('should handle empty data gracefully', () => {
      const result = calculateBiData([], []);
      expect(result).toEqual([]);
    });

    it('should filter out Bi entries with invalid time ranges', () => {
      const invalidBi: IFetchBi[] = [
        {
          startTime: new Date('2099-01-01'),
          endTime: new Date('2099-01-03'),
          high: 100,
          low: 90,
          trend: TrendDirection.Up,
          type: BiType.Complete,
          status: 1,
          independentCount: 2,
          originIds: [1, 2],
          originData: [],
          startFenxing: null,
          endFenxing: null,
        },
      ];
      const result = calculateBiData(mockK, invalidBi);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateDuanData and createDuanPlaceholders', () => {
    const mockDuan: IFetchDuan[] = [
      {
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-05'),
        high: 115,
        low: 95,
        trend: TrendDirection.Up,
        type: DuanType.Complete,
        status: DuanStatus.Valid,
        independentCount: 5,
        originIds: [1, 2, 3, 4, 5],
        originBis: mockBi,
        startBi: mockBi[0],
        endBi: mockBi[1],
      },
    ];

    it('should calculate Duan mapped data correctly', () => {
      const result = calculateDuanData(mockK, mockDuan);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        duanId: 0,
        startIndex: 0,
        endIndex: 4,
        startPrice: 95,
        endPrice: 115,
        trend: TrendDirection.Up,
      });
    });

    it('should create duan placeholders at midpoint', () => {
      const duanData = calculateDuanData(mockK, mockDuan);
      const placeholders = createDuanPlaceholders(duanData, 5);
      expect(placeholders).toHaveLength(5);
      expect(placeholders[2]).toBe(0); // mid of 0..4 is 2
    });
  });

  describe('calculateDuanChannelData', () => {
    const mockDuanChannel: IFetchDuanChannel[] = [
      {
        startId: 1,
        endId: 5,
        displayStartId: 1,
        displayEndId: 5,
        zg: 108,
        zd: 102,
        gg: 115,
        dd: 95,
        level: ChannelLevel.Duan,
        type: ChannelType.Complete,
        duans: [],
      },
    ];

    it('should calculate DuanChannel mapped data correctly', () => {
      const result = calculateDuanChannelData(mockK, mockDuanChannel);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        channelId: 0,
        startIndex: 0,
        endIndex: 4,
        zg: 108,
        zd: 102,
      });
    });

    it('should create duanChannel placeholders at startIndex', () => {
      const channelData = calculateDuanChannelData(mockK, mockDuanChannel);
      const placeholders = createDuanChannelPlaceholders(channelData, 5);
      expect(placeholders).toHaveLength(5);
      expect(placeholders[0]).toBe(0);
    });
  });

  describe('calculateBspData and placeholders', () => {
    const mockSignals = [
      {
        signalTime: '2024-01-03',
        type: 'first_sell',
        price: 115,
      },
      {
        signalTime: '2024-01-01',
        type: 'first_buy',
        price: 95,
      },
    ];

    it('should map buy/sell points accurately to K-lines', () => {
      const result = calculateBspData(mockK, mockSignals);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: 'first_sell',
        label: '1卖',
        isBuy: false,
        price: 115,
        index: 2,
      });
      expect(result[1]).toMatchObject({
        type: 'first_buy',
        label: '1买',
        isBuy: true,
        price: 95,
        index: 0,
      });
    });

    it('should create bsp placeholders at respective indices', () => {
      const bspData = calculateBspData(mockK, mockSignals);
      const placeholders = createBspPlaceholders(bspData, 5);
      expect(placeholders[2]).toBe(0);
      expect(placeholders[0]).toBe(1);
      expect(placeholders[1]).toBeNull();
    });
  });

  describe('calculateMacd', () => {
    it('should compute MACD values for valid K series', () => {
      const macd = calculateMacd(mockK);
      expect(macd.dif).toHaveLength(5);
      expect(macd.dea).toHaveLength(5);
      expect(macd.hist).toHaveLength(5);
      expect(typeof macd.dif[0]).toBe('number');
      expect(typeof macd.dea[0]).toBe('number');
      expect(typeof macd.hist[0]).toBe('number');
    });

    it('should handle empty K series gracefully', () => {
      const macd = calculateMacd([]);
      expect(macd.dif).toEqual([]);
      expect(macd.dea).toEqual([]);
      expect(macd.hist).toEqual([]);
    });
  });

  describe('createMergeKPlaceholders', () => {
    const mergeKRects = [
      { startIndex: 0, endIndex: 2, high: 120, low: 90, trend: TrendDirection.Up, rectId: 0 },
      { startIndex: 3, endIndex: 4, high: 115, low: 100, trend: TrendDirection.Down, rectId: 1 },
    ];

    it('should create placeholder array with rectIds at start positions', () => {
      const result = createMergeKPlaceholders(mergeKRects, 5);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe(0); // First rect starts at index 0
      expect(result[3]).toBe(1); // Second rect starts at index 3
      expect(result[1]).toBeNull(); // Other positions are null
      expect(result[2]).toBeNull();
      expect(result[4]).toBeNull();
    });

    it('should handle empty rects', () => {
      const result = createMergeKPlaceholders([], 5);
      expect(result).toHaveLength(5);
      expect(result.every(v => v === null)).toBe(true);
    });
  });

  describe('createBiPlaceholders', () => {
    const biData = [
      { startIndex: 0, endIndex: 4, startPrice: 95, endPrice: 110, trend: TrendDirection.Up, type: BiType.Complete, status: BiStatus.Valid, independentCount: 5, originData: mockK, high: 110, low: 95, biId: 0 },
    ];

    it('should create placeholder array with biId at middle position', () => {
      const result = createBiPlaceholders(biData, 5);

      expect(result).toHaveLength(5);
      expect(result[2]).toBe(0); // Middle of 0-4 is 2
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[3]).toBeNull();
      expect(result[4]).toBeNull();
    });

    it('should handle even number of K-lines correctly', () => {
      const biDataEven = [
        { startIndex: 0, endIndex: 3, startPrice: 95, endPrice: 110, trend: TrendDirection.Up, type: BiType.Complete, status: BiStatus.Valid, independentCount: 4, originData: mockK.slice(0, 4), high: 110, low: 95, biId: 0 },
      ];
      const result = createBiPlaceholders(biDataEven, 4);

      // Middle of 0-3 (4 elements) with Math.floor is 1
      expect(result[1]).toBe(0);
    });

    it('should handle empty biData', () => {
      const result = createBiPlaceholders([], 5);
      expect(result).toHaveLength(5);
      expect(result.every(v => v === null)).toBe(true);
    });
  });
});

