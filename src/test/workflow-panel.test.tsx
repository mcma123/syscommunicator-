import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { WorkflowPanel } from "../features/school/workflow-panel";
const state = vi.hoisted(() => ({ submit: vi.fn(), offline: false, creation: false }));
vi.mock("../features/school/store", () => ({
  useSchool: () => ({ offline: state.offline, emailReady: false }),
  useWorkflows: (_module: string, itemId?: string) => ({
    status: "ready",
    forms: state.creation
      ? [
          {
            action: itemId ? "noticeReview" : "noticeSave",
            title: itemId ? "Submit for review" : "Create notice draft",
            description: "School draft",
            fields: [],
          },
        ]
      : [
          {
            action: "enquiryReply",
            title: "Send reply",
            description: "Saved in your school thread",
            confirm: true,
            fields: [
              { name: "body", label: "Reply", type: "multiline", value: "", required: true },
            ],
          },
        ],
    submit: state.submit,
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.offline = false;
  state.creation = false;
});
it("retains success feedback when a newly created record changes the available workflow", async () => {
  state.creation = true;
  state.submit.mockResolvedValue({ id: "new-notice" });
  render(<WorkflowPanel module="messages" />);
  fireEvent.click(screen.getByRole("button", { name: "School actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Create notice draft" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument(),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Changes saved.");
});
it("requires explicit confirmation, disables pending writes and reports persisted success", async () => {
  let done!: (v: { id: string }) => void;
  state.submit.mockImplementation(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  render(<WorkflowPanel module="contact" itemId="thread-id" />);
  fireEvent.click(screen.getByRole("button", { name: "School actions" }));
  const save = screen.getByRole("button", { name: "Send reply" });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Follow up" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(save);
  expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
  done({ id: "thread-id" });
  await waitFor(() => expect(screen.getByText("Changes saved.")).toBeInTheDocument());
  expect(state.submit).toHaveBeenCalledWith(
    { action: "enquiryReply", itemId: "thread-id", values: { body: "Follow up" } },
    undefined,
  );
});
it("preserves the draft and shows server validation after a failed write", async () => {
  state.submit.mockRejectedValue({ data: { message: "The enquiry is resolved." } });
  render(<WorkflowPanel module="contact" itemId="thread-id" />);
  fireEvent.click(screen.getByRole("button", { name: "School actions" }));
  fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Keep my draft" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("The enquiry is resolved."),
  );
  expect(screen.getByLabelText("Reply")).toHaveValue("Keep my draft");
  expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
});
