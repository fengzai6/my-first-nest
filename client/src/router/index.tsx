import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

const Router = () => {
  return <RouterProvider router={router} />;
};

export default Router;
