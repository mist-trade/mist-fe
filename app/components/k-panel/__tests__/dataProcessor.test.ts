import { calculateMergeKRects, calculateBiData, createMergeKPlaceholders, createBiPlaceholders } from '../utils/dataProcessor';
import { TrendDirection, BiType } from '@/app/api/fetch';
import type { IFetchK, IMergeK, IFetchBi } from '@/app/api/fetch';

describe('DataProcessor', () => {
  const mockK: IFetchK[] = [
    { id: 1, symbol: '000300', time: new Date('2024-01-01'), amount: 1000, open: 100, close: 105, highest: 110, lowest: 95 },
    { id: 2, symbol: '000300', time: new Date('2024-01-02'), amount: 1200, open: 105, close: 108, highest: 112, lowest: 103 },
    { id: 3, symbol: '000300', time: new Date('2024-01-03'), amount: 1100, open: 108, close: 102, highest: 115, lowest: 100 },
    { id: 4, symbol: '000300', time: new Date('2024-01-04'), amount: 1300, open: 102, close: 107, highest: 110, lowest: 101 },
    { id: 5, symbol: '000300', time: new Date('2024-01-05'), amount: 1400, open: 107, close: 112, highest: 115, lowest: 106 },
  ];

  const mockMergeK: IMergeK[] = [
    { startTime: new Date('2024-01-01'), endTime: new Date('2024-01-02'), highest: 115, lowest: 95, trend: TrendDirection.Up, mergedCount: 2, mergedIds: [1, 2], mergedData: [mockK[0], mockK[1]] },
    { startTime: new Date('2024-01-03'), endTime: new Date('2024-01-04'), highest: 110, lowest: 100, trend: TrendDirection.Down, mergedCount: 2, mergedIds: [3, 4], mergedData: [mockK[2], mockK[3]] },
  ];

  const mockBi: IFetchBi[] = [
    { startTime: new Date('2024-01-01'), endTime: new Date('2024-01-03'), highest: 110, lowest: 95, trend: TrendDirection.Up, type: BiType.Complete, independentCount: 3, originIds: [1, 2, 3], originData: [mockK[0], mockK[1], mockK[2]] },
    { startTime: new Date('2024-01-03'), endTime: new Date('2024-01-05'), highest: 115, lowest: 100, trend: TrendDirection.Down, type: BiType.UnComplete, independentCount: 3, originIds: [3, 4, 5], originData: [mockK[2], mockK[3], mockK[4]] },
  ];

  describe('calculateMergeKRects', () => {
    it('should calculate merge K rectangles correctly', () => {
      const result = calculateMergeKRects(mockK, mockMergeK);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        startIndex: 0,
        endIndex: 1,
        highest: 115,
        lowest: 95,
        trend: TrendDirection.Up,
        rectId: 0,
      });
      expect(result[1]).toMatchObject({
        startIndex: 2,
        endIndex: 3,
        highest: 110,
        lowest: 100,
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
  });

  describe('calculateBiData', () => {
    it('should calculate Bi data correctly', () => {
      const result = calculateBiData(mockK, mockBi);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        startIndex: 0,
        endIndex: 2,
        startPrice: 95, // lowest for Up trend
        endPrice: 110, // highest for Up trend
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
        { startTime: new Date('2099-01-01'), endTime: new Date('2099-01-03'), highest: 100, lowest: 90, trend: TrendDirection.Up, type: BiType.Complete, independentCount: 2, originIds: [1, 2], originData: [] },
      ];
      const result = calculateBiData(mockK, invalidBi);
      expect(result).toHaveLength(0);
    });
  });

  describe('createMergeKPlaceholders', () => {
    const mergeKRects = [
      { startIndex: 0, endIndex: 2, highest: 120, lowest: 90, trend: TrendDirection.Up, rectId: 0 },
      { startIndex: 3, endIndex: 4, highest: 115, lowest: 100, trend: TrendDirection.Down, rectId: 1 },
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
      { startIndex: 0, endIndex: 4, startPrice: 95, endPrice: 110, trend: TrendDirection.Up, type: BiType.Complete, independentCount: 5, originData: mockK, highest: 110, lowest: 95, biId: 0 },
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
        { startIndex: 0, endIndex: 3, startPrice: 95, endPrice: 110, trend: TrendDirection.Up, type: BiType.Complete, independentCount: 4, originData: mockK.slice(0, 4), highest: 110, lowest: 95, biId: 0 },
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
