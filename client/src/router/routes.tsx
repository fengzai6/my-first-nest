import { Home } from "@/pages/home";
import { Login } from "@/pages/login";
import { Users } from "@/pages/management/users";
import { NotFound } from "@/pages/not-found";
import { Register } from "@/pages/register";
import { Navigate, Outlet, type RouteObject } from "react-router";
import { AuthGuard } from "./auth-guard";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: <AuthGuard />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "management",
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <Navigate to="/management/users" replace />,
          },
          {
            path: "users",
            element: <Users />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
