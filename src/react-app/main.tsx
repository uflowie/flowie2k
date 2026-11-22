import { StrictMode } from "react";
import "./index.css";

import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { startListenTracker } from "@/react-app/lib/listen-tracker";
import { applyAppearance, readAppearance } from "@/react-app/lib/appearance";

// Apply the saved look before the first render to avoid a flash of the default colors.
applyAppearance(readAppearance());

// Create a new router instance
const router = createRouter({ routeTree });
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 24 * 60 * 60_000 },
  },
});
const persister = createAsyncStoragePersister({ storage: window.localStorage });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  startListenTracker();
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </StrictMode>,
  );
}
