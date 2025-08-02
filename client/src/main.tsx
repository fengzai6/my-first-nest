import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Loading } from "./components/loading";
import "./index.css";

const App = lazy(() => import("./app"));

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<Loading fullScreen />}>
    <App />
  </Suspense>,
);
