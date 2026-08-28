import {
  formatShanghaiDateTime,
  formatShanghaiDate,
  formatShanghaiTime,
  formatShanghaiShort,
  formatShanghaiLocalDateTimeInput,
  parseShanghaiDateTimeToIso,
  getShanghaiDateParts,
} from "../time";

describe("time utility (Asia/Shanghai)", () => {
  const utcSample = "2026-06-18T02:20:00.000Z"; // 10:20:00 CST

  it("formats full date-time in Asia/Shanghai", () => {
    expect(formatShanghaiDateTime(utcSample)).toBe("2026-06-18 10:20:00");
    expect(formatShanghaiDateTime(null)).toBe("-");
    expect(formatShanghaiDateTime("")).toBe("-");
  });

  it("formats date in Asia/Shanghai", () => {
    expect(formatShanghaiDate(utcSample)).toBe("2026-06-18");
    expect(formatShanghaiDate(null)).toBe("-");
  });

  it("formats time in Asia/Shanghai", () => {
    expect(formatShanghaiTime(utcSample)).toBe("10:20:00");
  });

  it("formats short date-time in Asia/Shanghai", () => {
    expect(formatShanghaiShort(utcSample)).toBe("06-18 10:20:00");
  });

  it("formats datetime-local input string in Asia/Shanghai", () => {
    const d = new Date(utcSample);
    expect(formatShanghaiLocalDateTimeInput(d)).toBe("2026-06-18T10:20:00");
  });

  it("parses Shanghai datetime-local string to UTC ISO", () => {
    const input = "2026-06-18T10:20:00";
    expect(parseShanghaiDateTimeToIso(input)).toBe("2026-06-18T02:20:00.000Z");
  });

  it("extracts Shanghai date parts correctly", () => {
    const d = new Date(utcSample);
    const parts = getShanghaiDateParts(d);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(6);
    expect(parts.day).toBe(18);
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(20);
  });
});
