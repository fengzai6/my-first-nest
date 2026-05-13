import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, message, Spin, Tabs, Tag } from "antd";

import {
  GetProfile,
  GetUserPermissions,
  UpdatePassword,
  UpdateProfile,
} from "@/services/api/account";
import { useUserStore } from "@/stores/user";

import { PasswordForm } from "./components/password-form";
import { ProfileForm } from "./components/profile-form";

export const Settings = () => {
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);

  const { data: user, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: GetProfile,
  });

  const { data: permissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: GetUserPermissions,
  });

  const updateProfileMutation = useMutation({
    mutationFn: UpdateProfile,
    onSuccess: (updatedUser) => {
      message.success("个人信息更新成功");
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => {
      message.error(error.message || "更新失败，请重试");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: UpdatePassword,
    onSuccess: () => {
      message.success("密码修改成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "密码修改失败，请重试");
    },
  });

  const tabItems = [
    {
      key: "profile",
      label: "个人信息",
      children: isLoadingProfile ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : user ? (
        <ProfileForm
          user={user}
          onSubmit={updateProfileMutation.mutate}
          loading={updateProfileMutation.isPending}
        />
      ) : null,
    },
    {
      key: "password",
      label: "修改密码",
      children: (
        <PasswordForm
          onSubmit={updatePasswordMutation.mutate}
          loading={updatePasswordMutation.isPending}
        />
      ),
    },
    {
      key: "permissions",
      label: "我的权限",
      children: isLoadingPermissions ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {permissions && permissions.length > 0 ? (
            permissions.map((permission) => (
              <Tag key={permission.id} color="blue">
                {permission.name}
              </Tag>
            ))
          ) : (
            <span className="text-gray-500">暂无权限</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card title="个人设置">
      <Tabs items={tabItems} />
    </Card>
  );
};
