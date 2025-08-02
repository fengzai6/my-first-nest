import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

const Router = () => {
  return <RouterProvider router={createBrowserRouter(routes)} />;
};

export default Router;
