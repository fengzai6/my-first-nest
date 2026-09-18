import NestJsIcon from "@/assets/nestjs.svg";
import {
  ApiOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  HomeOutlined,
  PaperClipOutlined,
  SettingOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons";
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
import { SpecialRoles } from "@/services/types/user";
import { useUserStore } from "@/stores/user";
import { useUserPermissionContext } from "@/components/root/user-permission-context";

const sidebarGroups = [
  {
    label: "For U",
    content: [
      {
        name: "Home",
        icon: <HomeOutlined />,
        path: "/",
      },
      {
        name: "Socket Demo",
        icon: <ApiOutlined />,
        path: "/socket-demo",
      },
      {
        name: "缓存能力",
        icon: <DatabaseOutlined />,
        path: "/cache-capabilities",
      },
      {
        name: "资料文档",
        icon: <FileTextOutlined />,
        path: "/documents",
      },
      {
        name: "任务中心",
        icon: <FieldTimeOutlined />,
        path: "/jobs",
      },
      {
        name: "个人设置",
        icon: <SettingOutlined />,
        path: "/settings",
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
      {
        name: "角色管理",
        icon: <UserOutlined />,
        path: "/management/roles",
      },
      {
        name: "群组管理",
        icon: <UserOutlined />,
        path: "/management/groups",
      },
      {
        name: "猫咪管理",
        icon: <SmileOutlined />,
        path: "/management/cats",
      },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const user = useUserStore((state) => state.user);
  const { permissions } = useUserPermissionContext();
  const canReadAttachments = permissions.includes("attachment:read");
  // NOTE: 隐藏菜单只是体验优化，不是安全边界：直接访问 /logs 页面能打开，但后端 SpecialRolesGuard 会让接口返回 403。
  const canViewLogs = user.specialRoles?.some(
    (role) =>
      role === SpecialRoles.Developer || role === SpecialRoles.SuperAdmin,
  );

  const visibleSidebarGroups = sidebarGroups.map((group, index) => {
    if (group.label === "后台管理") {
      return {
        ...group,
        content: [
          ...group.content,
          ...(canReadAttachments
            ? [
                {
                  name: "附件管理",
                  icon: <PaperClipOutlined />,
                  path: "/management/attachments",
                },
              ]
            : []),
        ],
      };
    }

    return canViewLogs
      ? (() => {
        if (index !== 0) return group;

        return {
          ...group,
          content: [
            ...group.content,
            {
              name: "日志",
              icon: <FileTextOutlined />,
              path: "/logs",
            },
          ],
        };
      })()
      : group;
  });

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
        {visibleSidebarGroups.map((item, index) => {
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
