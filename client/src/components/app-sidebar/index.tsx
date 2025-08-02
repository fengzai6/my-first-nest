import NestJsIcon from "@/assets/nestjs.svg";
import { HomeOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation } from "react-router";
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
        path: "/home",
      },
    ],
  },
  {
    label: "后台管理",
    content: [
      {
        name: "用户管理",
        icon: <UserOutlined />,
        path: "/users",
      },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();

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
                    <SidebarMenuButton
                      tooltip={contentItem.name}
                      isActive={location.pathname.startsWith(contentItem.path)}
                    >
                      {contentItem.icon}
                      <span>{contentItem.name}</span>
                    </SidebarMenuButton>
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
