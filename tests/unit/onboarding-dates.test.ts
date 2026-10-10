import { describe, expect, it } from "vitest";
import {
  formatFrenchDate,
  formatLongFrenchDate,
  maskFrenchDate,
  parseFrenchDate,
} from "../../src/features/onboarding/dates";

describe("French date input", () => {
  it("masks typed digits as JJ/MM/AAAA", () => {
    expect(maskFrenchDate("1")).toBe("1");
    expect(maskFrenchDate("1406")).toBe("14/06");
    expect(maskFrenchDate("14061991")).toBe("14/06/1991");
    expect(maskFrenchDate("14/06/1991 extra 22")).toBe("14/06/1991");
    expect(maskFrenchDate("14-06-1991")).toBe("14/06/1991");
  });
  it("parses only real calendar dates", () => {
    expect(parseFrenchDate("14/06/1991")).toBe("1991-06-14");
    expect(parseFrenchDate("29/02/2028")).toBe("2028-02-29");
    expect(parseFrenchDate("29/02/2027")).toBeUndefined();
    expect(parseFrenchDate("31/04/2027")).toBeUndefined();
    expect(parseFrenchDate("14/06")).toBeUndefined();
    expect(parseFrenchDate("")).toBeNull();
  });
  it("formats stored dates for display in French", () => {
    expect(formatFrenchDate("2027-03-20")).toBe("20/03/2027");
    expect(formatFrenchDate(null)).toBe("");
    expect(formatLongFrenchDate("2027-03-20")).toBe("Samedi 20 mars 2027");
  });
});
