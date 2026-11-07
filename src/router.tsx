import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const url = import.meta.env["VITE_CONVEX_URL"] as string | undefined;
  const convexClient = url ? new ConvexReactClient(url) : null;
  const bridge = convexClient ? new ConvexQueryClient(convexClient) : null;
  const queryClient = new QueryClient(
    bridge
      ? {
          defaultOptions: {
            queries: { queryKeyHashFn: bridge.hashFn(), queryFn: bridge.queryFn() },
          },
        }
      : undefined,
  );
  bridge?.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient, convexClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
