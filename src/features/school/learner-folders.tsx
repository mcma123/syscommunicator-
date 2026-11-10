import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, Search, Users } from "lucide-react";
import { Empty, Placeholder } from "./components";
import { useRecords } from "./store";
import { countLabel, groupClasses, type ClassFolder } from "@school-connect/core/live";

/**
 * Staff Learners browser: grade folders → class folders → that class's learners.
 * Teachers only receive their own classes from the server; Principals and Administrators see all.
 */
export function LearnerFolders({
  renderClass,
  renderSearch,
  renderClassTools,
}: {
  renderClass: (classId: string) => ReactNode;
  renderSearch: () => ReactNode;
  /** Optional class actions (e.g. CSV import) shown above the class's learners. */
  renderClassTools?: (folder: ClassFolder) => ReactNode;
}) {
  const [mode, setMode] = useState<"browse" | "search">("browse");
  const [grade, setGrade] = useState<string>();
  const [classId, setClassId] = useState<string>();
  const result = useRecords("classes");
  const { canLoadMore, loadingMore, loadMore } = result;
  // Classes are few; load every page so grade folders are complete.
  useEffect(() => {
    if (canLoadMore && !loadingMore) loadMore();
  }, [canLoadMore, loadingMore, loadMore]);
  const grades = useMemo(() => groupClasses(result.data.records), [result.data.records]);
  const currentGrade = grades.find((g) => g.name === grade);
  const currentClass = currentGrade?.classes.find((c) => c.id === classId);
  const loading = result.status === "loading" || canLoadMore;

  return (
    <section className="learner-folders">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Learner view">
          <button type="button" aria-pressed={mode === "browse"} onClick={() => setMode("browse")}>
            <Folder size={13} /> Browse by grade
          </button>
          <button type="button" aria-pressed={mode === "search"} onClick={() => setMode("search")}>
            <Search size={13} /> Search all learners
          </button>
        </div>
      </div>
      {mode === "search" ? (
        renderSearch()
      ) : (
        <>
          <nav className="folder-crumbs" aria-label="Learner folders">
            <button
              type="button"
              aria-current={!grade ? "page" : undefined}
              onClick={() => {
                setGrade(undefined);
                setClassId(undefined);
              }}
            >
              All grades
            </button>
            {currentGrade && (
              <>
                <ChevronRight size={13} aria-hidden />
                <button
                  type="button"
                  aria-current={!classId ? "page" : undefined}
                  onClick={() => setClassId(undefined)}
                >
                  {currentGrade.name}
                </button>
              </>
            )}
            {currentClass && (
              <>
                <ChevronRight size={13} aria-hidden />
                <span aria-current="page">{currentClass.label}</span>
              </>
            )}
          </nav>
          {loading && !grades.length ? (
            <Placeholder rows={2} height={90} />
          ) : !grades.length ? (
            <Empty
              title="No classes yet"
              text="Classes you teach (or, for school leaders, every class) appear here."
            />
          ) : currentClass ? (
            <div className="folder-class">
              <div className="folder-class-head">
                <FolderOpen size={20} />
                <div>
                  <h2>{currentClass.label}</h2>
                  <p>
                    {currentClass.teacher ? `Class teacher: ${currentClass.teacher} · ` : ""}
                    {countLabel(currentClass.learners, "learner")}
                  </p>
                </div>
              </div>
              {renderClassTools?.(currentClass)}
              {renderClass(currentClass.id)}
            </div>
          ) : currentGrade ? (
            <div className="folder-grid">
              {currentGrade.classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="folder-card"
                  onClick={() => setClassId(c.id)}
                >
                  <Folder size={26} />
                  <strong>{c.label}</strong>
                  <span>
                    {countLabel(c.learners, "learner")}
                    {c.teacher ? ` · ${c.teacher}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="folder-grid">
              {grades.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  className="folder-card is-grade"
                  onClick={() => setGrade(g.name)}
                >
                  <Folder size={30} />
                  <strong>{g.name}</strong>
                  <span>
                    <Users size={12} />
                    {g.classes.length === 1 ? "1 class" : `${g.classes.length} classes`} ·{" "}
                    {countLabel(g.learners, "learner")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
