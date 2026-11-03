import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBookingHours,
  calculateBookingTotal,
  isValidBookingDate,
  isValidTimeRange,
  overlaps,
} from "../dist/lib/booking-rules.js";

test("accepts real ISO calendar dates and rejects invalid dates", () => {
  assert.equal(isValidBookingDate("2026-11-02"), true);
  assert.equal(isValidBookingDate("2026-02-29"), false);
  assert.equal(isValidBookingDate("2026-13-01"), false);
  assert.equal(isValidBookingDate("02-11-2026"), false);
});

test("validates increasing 24-hour time windows", () => {
  assert.equal(isValidTimeRange("10:00", "12:00"), true);
  assert.equal(isValidTimeRange("12:00", "10:00"), false);
  assert.equal(isValidTimeRange("25:00", "26:00"), false);
  assert.equal(isValidTimeRange("10:60", "11:30"), false);
});

test("detects overlapping windows but allows adjacent sessions", () => {
  assert.equal(overlaps("11:00", "13:00", "10:00", "12:00"), true);
  assert.equal(overlaps("12:00", "13:00", "10:00", "12:00"), false);
  assert.equal(overlaps("09:00", "10:00", "10:00", "12:00"), false);
  assert.equal(overlaps("10:00", "12:00", "10:00", "12:00"), true);
});

test("calculates accurate duration and total including deposit", () => {
  assert.equal(calculateBookingHours("09:30", "12:00"), 2.5);
  assert.equal(calculateBookingTotal(2.5, 80, 100), 300);
  assert.throws(() => calculateBookingHours("12:00", "10:00"), RangeError);
});