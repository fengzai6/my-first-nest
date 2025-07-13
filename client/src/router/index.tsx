import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

export const Router = () => {
  return <RouterProvider router={createBrowserRouter(routes)} />;
};
