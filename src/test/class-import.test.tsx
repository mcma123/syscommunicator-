import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassFolder } from "@school-connect/core/live";
import { ClassImport } from "../features/school/class-import";

const preview = vi.fn();
const commit = vi.fn();
const complete = vi.fn();
vi.mock("../features/school/store", () => ({
  useClassImport: () => ({ enabled: true, preview, commit, complete }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const folder: ClassFolder = {
  id: "c4b",
  name: "4B",
  label: "Grade 4B",
  grade: "Grade 4",
  gradeOrder: 4,
  teacher: "Ms Jacobs",
  learners: "24",
  year: 2026,
};
const csv = [
  "learner_number,first_name,last_name,parent_email,parent_first_name,parent_last_name,parent_relationship",
  "WG-1,Sipho,Ndlovu,mom@example.org,Lindiwe,Ndlovu,Mother",
  "WG-2,Ava,Botha,,,,",
  "WG-3,,Smith,,,,",
].join("\n");
/** jsdom's File has no text(); browsers do. */
const file = (text: string, name = "4B.csv") => {
  const f = new File([text], name, { type: "text/csv" });
  Object.defineProperty(f, "text", { value: async () => text });
  return f;
};

describe("class CSV import", () => {
  it("reads a class file, checks it and imports learners then parent contacts", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    preview.mockResolvedValue([
      { row: 2, outcome: "create", messages: [] },
      { row: 3, outcome: "create", messages: [] },
    ]);
    commit.mockImplementation(
      async ({ kind, rows }: { kind: string; rows: { row: number }[] }) => ({
        batchId: `${kind}-batch`,
        results: rows.map((r) => ({ row: r.row, outcome: "create", messages: [] })),
      }),
    );
    render(<ClassImport folder={folder} />);
    fireEvent.click(screen.getByRole("button", { name: /Import learners \(CSV\)/ }));
    expect(screen.getByRole("link", { name: /Download the class template/ })).toHaveAttribute(
      "download",
      "Grade-4B-learners.csv",
    );
    const input = screen.getByLabelText(/Drop the CSV file here/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file(csv)] } });
    expect(
      await screen.findByText(
        /3 rows read: 2 learners ready \(1 with a parent contact\), 1 problems/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("first_name: This value is required.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check against school records" }));
    await screen.findByText(/2 new, 0 updated/);
    const cells = preview.mock.calls[0]![0].rows[0].cells;
    expect(cells).toMatchObject({ grade: "Grade 4", class_name: "4B", year: "2026" });

    fireEvent.click(screen.getByRole("button", { name: "Import 2 learners" }));
    await screen.findByText(/Import complete/);
    expect(commit.mock.calls.map((c) => [c[0].kind, c[0].rows.length])).toEqual([
      ["learners", 2],
      ["guardians", 1],
    ]);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Parent contact saved for the office to invite/)).toBeInTheDocument();
  });

  it("refuses files that are not CSV", async () => {
    render(<ClassImport folder={folder} />);
    fireEvent.click(screen.getByRole("button", { name: /Import learners \(CSV\)/ }));
    fireEvent.change(screen.getByLabelText(/Drop the CSV file here/), {
      target: { files: [new File(["x"], "list.xlsx", { type: "application/vnd.ms-excel" })] },
    });
    await waitFor(() => expect(screen.getByText(/Choose a .csv file/)).toBeInTheDocument());
    expect(preview).not.toHaveBeenCalled();
  });
});
