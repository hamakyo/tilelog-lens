import { describe, expect, it } from "vitest";
import {
  getConsistencyWarnings,
  snapshotCreateSchema
} from "../src/shared/schema";
import { RANK_POINT_MAX_BY_RANK_AND_LEVEL } from "../src/shared/constants";
import { baseSnapshotInput } from "./fixtures";

describe("snapshot validation", () => {
  it("rejects missing observed_time", () => {
    const { observed_time: _observedTime, ...input } = baseSnapshotInput;
    expect(snapshotCreateSchema.safeParse(input).success).toBe(false);
  });

  it("accepts 00:00 and 23:59, rejects 24:00 and 29:59", () => {
    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        observed_time: "00:00"
      }).success
    ).toBe(true);

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

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        observed_time: "29:59"
      }).success
    ).toBe(false);
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

  it("accepts only the three Mahjong Soul rank levels", () => {
    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        rank_level: 1
      }).success
    ).toBe(true);

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        rank_level: 3
      }).success
    ).toBe(true);

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        rank_level: 0
      }).success
    ).toBe(false);

    expect(
      snapshotCreateSchema.safeParse({
        ...baseSnapshotInput,
        rank_level: 4
      }).success
    ).toBe(false);
  });

  it("defines Mahjong Soul promotion point caps for rank and level selections", () => {
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.初心?.[1]).toBe(20);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.初心?.[3]).toBe(200);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀士?.[1]).toBe(600);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀士?.[3]).toBe(1000);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀傑?.[3]).toBe(2000);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀豪?.[3]).toBe(3600);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀聖?.[1]).toBe(4000);
    expect(RANK_POINT_MAX_BY_RANK_AND_LEVEL.雀聖?.[3]).toBe(9000);
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
