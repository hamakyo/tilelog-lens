import { describe, expect, it } from "vitest";
import {
  getConsistencyWarnings,
  snapshotCreateSchema
} from "../src/shared/schema";
import { baseSnapshotInput } from "./fixtures";

describe("snapshot validation", () => {
  it("rejects missing observed_time", () => {
    const { observed_time: _observedTime, ...input } = baseSnapshotInput;
    expect(snapshotCreateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects 24:00 and accepts 23:59", () => {
    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        observed_time: "24:00"
      }).success
    ).toBe(false);

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        observed_time: "23:59"
      }).success
    ).toBe(true);
  });

  it("rejects invalid dates and rates outside 0-100", () => {
    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        observed_date: "2026-02-30"
      }).success
    ).toBe(false);

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        win_rate: 101
      }).success
    ).toBe(false);
  });

  it("warns on placement-rate sum and average-place mismatch", () => {
    const warnings = getConsistencyWarnings({
      ...baseSnapshotInput,
      first_rate: 50,
      second_rate: 10,
      third_rate: 10,
      fourth_rate: 10,
      avg_place: 1.1
    });

    expect(warnings.map((warning) => warning.code)).toContain(
      "RANK_RATE_SUM_NOT_100"
    );
    expect(warnings.map((warning) => warning.code)).toContain(
      "AVG_PLACE_MISMATCH"
    );
  });
});
