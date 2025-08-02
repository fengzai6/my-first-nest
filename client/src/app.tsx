import queryClient from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Loading } from "./components/loading";
import { Toaster } from "./components/ui/sonner";

const Router = lazy(() => import("./router"));

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Loading fullScreen />}>
        <Router />
        <Toaster position="top-center" richColors />
      </Suspense>
    </QueryClientProvider>
  );
};

export default App;
