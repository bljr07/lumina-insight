import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { GhostMode } from "@/components/GhostMode";

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("GhostMode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a safe empty-state when timelinePoints is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ghostData: [], timelinePoints: [] }), { status: 200 })
    );

    renderWithQuery(<GhostMode />);

    await waitFor(() => {
      expect(screen.getByText(/No historical timeline available yet/i)).toBeInTheDocument();
    });
  });
});
