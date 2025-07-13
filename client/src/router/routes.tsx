import { type RouteObject } from "react-router";
import { Home } from "@/pages/home";
import { Login } from "@/pages/login";
import { NotFound } from "@/pages/not-found";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
