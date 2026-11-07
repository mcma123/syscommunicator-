import { describe, expect, it } from "vitest";
import {
  IMPORT_KINDS,
  IMPORT_MAX_ROWS,
  importTemplateCsv,
  parseCsv,
  parseImportCsv,
} from "@school-connect/core/imports";

describe("roster import CSV", () => {
  it("parses quotes, escaped quotes, embedded newlines, CRLF and BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"multi\nline",\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["multi\nline", ""],
    ]);
    expect(() => parseCsv('a\n"open')).toThrow(/unclosed/);
  });

  it("offers a header-only template for every kind that parses back cleanly", () => {
    for (const kind of IMPORT_KINDS) {
      const result = parseImportCsv(kind, importTemplateCsv(kind));
      expect(result.errors).toEqual([]);
      expect(result.totalRows).toBe(0);
    }
  });

  it("rejects a header that does not match the template", () => {
    const result = parseImportCsv("learners", "learner_number,name\nL1,Ann");
    expect(result.rows).toEqual([]);
    expect(result.errors[0]!.message).toMatch(/missing columns: first_name/);
    expect(result.errors[0]!.message).toMatch(/unknown columns: name/);
  });

  it("normalizes valid learner rows and reports per-row field errors", () => {
    const csv = [
      importTemplateCsv("learners").trim(),
      "WG-001, Emma ,Williams,,2017-03-04,Grade 4,4B,2026",
      "WG-002,Ava,,,2017-02-30,Grade 4,4B,26",
    ].join("\n");
    const result = parseImportCsv("learners", csv);
    expect(result.rows).toEqual([
      {
        row: 2,
        key: "WG-001",
        data: {
          learnerNumber: "WG-001",
          firstName: "Emma",
          lastName: "Williams",
          preferredName: undefined,
          dateOfBirth: "2017-03-04",
          grade: "Grade 4",
          className: "4B",
          year: 2026,
        },
      },
    ]);
    expect(result.errors).toEqual([
      { row: 3, field: "last_name", message: "This value is required." },
      { row: 3, field: "date_of_birth", message: "Use the YYYY-MM-DD date format." },
      { row: 3, field: "year", message: "Use a four-digit year." },
    ]);
  });

  it("matches guardians on email plus learner number and rejects in-file duplicates", () => {
    const csv = [
      importTemplateCsv("guardians").trim(),
      "WG-001,Parent@Example.org,Jo,Williams,082 555 0101,mother,yes",
      "wg-001,parent@example.org,Jo,Williams,,Mother,no",
      "WG-002,parent@example.org,Jo,Williams,,Aunt,maybe",
    ].join("\n");
    const result = parseImportCsv("guardians", csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.data).toMatchObject({
      email: "parent@example.org",
      phone: "0825550101",
      relationship: "Mother",
      isPrimaryContact: true,
    });
    expect(result.errors).toEqual([
      { row: 3, message: "Duplicate of row 2." },
      { row: 4, field: "relationship", message: expect.stringMatching(/Use one of/) },
      { row: 4, field: "primary_contact", message: "Use yes or no." },
    ]);
  });

  it("validates staff roles and class lists", () => {
    const csv = [
      importTemplateCsv("staff").trim(),
      "t@example.org,Sarah,Jacobs,,teacher;Teacher;Principal,4B;4A,2026",
      "x@example.org,Sam,Lee,,Janitor,4B,",
    ].join("\n");
    const result = parseImportCsv("staff", csv);
    expect(result.rows[0]!.data).toMatchObject({
      roles: ["Teacher", "Principal"],
      classNames: ["4B", "4A"],
    });
    expect(result.errors.map((e) => e.field)).toEqual(["roles", "year"]);
  });

  it("refuses spreadsheet formula prefixes in free-text cells", () => {
    const csv = [
      importTemplateCsv("classes").trim(),
      '=HYPERLINK("x"),4B,2026',
      "Grade 4,@SUM(1),2026",
    ].join("\n");
    const result = parseImportCsv("classes", csv);
    expect(result.rows).toEqual([]);
    expect(result.errors.map((e) => [e.row, e.field])).toEqual([
      [2, "grade"],
      [3, "class_name"],
    ]);
  });

  it("caps file size", () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `Grade 1,1A${i},2026`);
    const result = parseImportCsv(
      "classes",
      [importTemplateCsv("classes").trim(), ...rows].join("\n"),
    );
    expect(result.rows).toEqual([]);
    expect(result.errors[0]!.message).toMatch(/at most 2000 rows/);
  });
});
