import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, setTheme, themeInitScript, useTheme } from "@/lib/theme";

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={() => toggleTheme()}>
      {theme}
    </button>
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  window.localStorage.clear();
});

describe("theme", () => {
  it("toggles the dark class and persists the choice", () => {
    render(<Probe />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("light");

    act(() => button.click());
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button).toHaveTextContent("dark");

    act(() => button.click());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores a saved theme before hydration", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    new Function(themeInitScript)();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("updates subscribers when the theme is set elsewhere", () => {
    render(<Probe />);
    act(() => setTheme("dark"));
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });
});
