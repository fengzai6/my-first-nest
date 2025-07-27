import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { UserOutlined, HomeOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router";

const menuItems = [
  {
    label: "首页",
    icon: <HomeOutlined />,
    path: "/home",
  },
  {
    label: "用户管理",
    icon: <UserOutlined />,
    path: "/users",
  },
];

export const AppSidebar = () => {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>管理系统</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(({ label, icon, path }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith(path)}>
                    <Link to={path}>
                      {icon}
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
