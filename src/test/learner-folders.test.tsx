import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModuleRecord } from "@school-connect/core/live";
import { classLabel, countLabel, groupClasses } from "@school-connect/core/live";
import { LearnerFolders } from "../features/school/learner-folders";

const klass = (id: string, name: string, grade: string, order: number, learners: string) =>
  ({
    id,
    title: name,
    body: "",
    subtitle: "Class",
    status: "2026",
    at: null,
    amountCents: null,
    read: false,
    acknowledged: false,
    canAcknowledge: false,
    category: grade,
    fields: [
      { label: "Grade", value: grade },
      { label: "Grade order", value: String(order) },
      { label: "Class teacher", value: "Ms Jacobs" },
      { label: "Learners", value: learners },
    ],
  }) satisfies ModuleRecord;
const records = [
  klass("c4b", "4B", "Grade 4", 4, "24"),
  klass("c1b", "1B", "Grade 1", 1, "1"),
  klass("c1a", "1A", "Grade 1", 1, "22"),
];

vi.mock("../features/school/store", () => ({
  useRecords: () => ({
    status: "ready",
    data: { records },
    canLoadMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
  }),
}));
afterEach(cleanup);

describe("staff learner folders", () => {
  it("groups classes by grade in grade order with readable class names", () => {
    const grades = groupClasses(records);
    expect(grades.map((g) => g.name)).toEqual(["Grade 1", "Grade 4"]);
    expect(grades[0]!.classes.map((c) => c.label)).toEqual(["Grade 1A", "Grade 1B"]);
    expect(grades[0]!.learners).toBe(23);
    expect(classLabel("Grade 2", "Blue")).toBe("Grade 2 · Blue");
    expect(countLabel(1, "learner")).toBe("1 learner");
    expect(countLabel("22", "learner")).toBe("22 learners");
  });

  it("opens grade → class → learners and navigates back with the breadcrumb", () => {
    const renderClass = vi.fn((id: string) => <p>Learners of {id}</p>);
    render(<LearnerFolders renderClass={renderClass} renderSearch={() => <p>All learners</p>} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade 1\s*2 classes/ }));
    expect(screen.getByRole("button", { name: /Grade 1A/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grade 1A/ }));
    expect(screen.getByText("Learners of c1a")).toBeInTheDocument();
    expect(screen.getByText(/Class teacher: Ms Jacobs · 22 learners/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All grades" }));
    expect(
      screen.getByRole("button", { name: /Grade 4\s*1 class · 24 learners/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search all learners/ }));
    expect(screen.getByText("All learners")).toBeInTheDocument();
  });
});
