import { CacheCapabilities } from "@/pages/cache-capabilities";
import { Documents } from "@/pages/documents";
import { Cats } from "@/pages/management/cats";
import { Home } from "@/pages/home";
import { Jobs } from "@/pages/jobs";
import { Login } from "@/pages/login";
import { Logs } from "@/pages/log";
import { Groups } from "@/pages/management/groups";
import { Roles } from "@/pages/management/roles";
import { Users } from "@/pages/management/users";
import { NotFound } from "@/pages/not-found";
import { Register } from "@/pages/register";
import { Settings } from "@/pages/settings";
import { SocketDemo } from "@/pages/socket-demo";
import { AttachmentsManagement } from "@/pages/management/attachments";
import { Navigate, Outlet, type RouteObject } from "react-router";
import { AuthGuard } from "./auth-guard";
import { PermissionGuard } from "./permission-guard";
import {
  LOG_ROUTE_ROLES,
  SpecialRoleGuard,
} from "./special-role-guard";

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
        path: "socket-demo",
        element: <SocketDemo />,
      },
      {
        path: "cache-capabilities",
        element: <CacheCapabilities />,
      },
      {
        path: "documents",
        element: <Documents />,
      },
      {
        path: "jobs",
        element: <Jobs />,
      },
      {
        element: <SpecialRoleGuard roles={LOG_ROUTE_ROLES} />,
        children: [
          {
            path: "logs",
            element: <Logs />,
          },
        ],
      },
      {
        path: "settings",
        element: <Settings />,
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
          {
            path: "roles",
            element: <Roles />,
          },
          {
            path: "groups",
            element: <Groups />,
          },
          {
            path: "cats",
            element: <Cats />,
          },
          {
            path: "attachments",
            element: (
              <PermissionGuard permissions={["attachment:read"]}>
                <AttachmentsManagement />
              </PermissionGuard>
            ),
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
