import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationPanel } from "../features/school/notification-panel";
const state = vi.hoisted(() => ({
  retry: vi.fn(),
  offline: false,
  status: "Accepted",
  canRetry: false,
}));
vi.mock("../features/school/store", () => ({
  useSchool: () => ({ offline: state.offline }),
  useNotifications: () => ({
    records: [
      {
        id: "delivery",
        name: "School guardian",
        kind: "Notice",
        channel: "Push",
        state: state.status,
        at: 1,
        canRetry: state.canRetry,
      },
    ],
    configuration: { enabled: true, registeredDevices: 1, emailConfigured: false },
    loading: false,
    error: false,
    retry: state.retry,
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.status = "Accepted";
  state.canRetry = false;
  state.offline = false;
});
it("distinguishes acceptance from confirmed delivery and separate read receipts", () => {
  render(<NotificationPanel noticeId="notice" />);
  expect(screen.getByText("School guardian · Push · Accepted")).toBeInTheDocument();
  expect(screen.getByText(/does not prove the phone displayed it/)).toBeInTheDocument();
  expect(screen.queryByText("School guardian · Push · Provider confirmed")).not.toBeInTheDocument();
});
it("requires an explicit retry, disables offline retries and waits for server confirmation", async () => {
  state.status = "Failed";
  state.canRetry = true;
  state.offline = true;
  const view = render(<NotificationPanel noticeId="notice" />);
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(state.retry).not.toHaveBeenCalled();
  state.offline = false;
  view.rerender(<NotificationPanel noticeId="notice" />);
  let complete!: () => void;
  state.retry.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(state.retry).toHaveBeenCalledWith({ deliveryId: "delivery" });
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  complete();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Retry requested."));
});
