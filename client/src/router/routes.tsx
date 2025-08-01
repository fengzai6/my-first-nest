import { Home } from "@/pages/home";
import { Login } from "@/pages/login";
import { NotFound } from "@/pages/not-found";
import { Register } from "@/pages/register";
import { Navigate, type RouteObject } from "react-router";
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
        element: <Navigate to="/home" replace />,
      },
      {
        path: "home",
        element: <Home />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
