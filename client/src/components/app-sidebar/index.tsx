import NestJsIcon from "@/assets/nestjs.svg";
import { HomeOutlined, UserOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { Link, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "../ui/sidebar";
import { NavUser } from "./nav-user";

const sidebarGroups = [
  {
    label: "For U",
    content: [
      {
        name: "Home",
        icon: <HomeOutlined />,
        path: "/",
      },
    ],
  },
  {
    label: "后台管理",
    content: [
      {
        name: "用户管理",
        icon: <UserOutlined />,
        path: "/management/users",
      },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();

  const getIsActive = useMemo(() => {
    return (path: string) => {
      if (path === "/") {
        return location.pathname === "/";
      }
      return location.pathname.startsWith(path);
    };
  }, [location.pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-2 py-[0.375rem]">
          <img src={NestJsIcon} alt="Logo" className="h-5 w-5" />
          {state === "expanded" && (
            <div className="text-sm whitespace-nowrap">My First Nest</div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sidebarGroups.map((item, index) => {
          return (
            <SidebarGroup key={index}>
              <SidebarGroupLabel>{item.label}</SidebarGroupLabel>
              <SidebarMenu>
                {item.content.map((contentItem, i) => (
                  <SidebarMenuItem key={contentItem.name + i}>
                    <Link to={contentItem.path}>
                      <SidebarMenuButton
                        tooltip={contentItem.name}
                        isActive={getIsActive(contentItem.path)}
                        className="cursor-pointer"
                      >
                        {contentItem.icon}
                        <span>{contentItem.name}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
