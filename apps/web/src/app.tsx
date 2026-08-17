import queryClient from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp } from "antd";
import { lazy, Suspense } from "react";
import { Loading } from "./components/loading";
import { Toaster } from "./components/ui/sonner";

const Router = lazy(() => import("./router"));

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Loading fullScreen />}>
        <AntdApp>
          <Router />
          <Toaster position="top-center" richColors />
        </AntdApp>
      </Suspense>
    </QueryClientProvider>
  );
};

export default App;
