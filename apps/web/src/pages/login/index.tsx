import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Login as loginApi } from "@/services/api/auth";
import { useUserStore } from "@/stores/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export const Login = () => {
  const navigate = useNavigate();
  const setJwtToken = useUserStore((state) => state.setJwtToken);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => loginApi(values),
    onSuccess: (data) => {
      setJwtToken(data);
      navigate("/");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight text-gray-900">
            登录
          </div>
          <div className="mt-2 text-sm text-gray-600">
            还没有账户？{" "}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              立即注册
            </Link>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户名</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入用户名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="请输入密码"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              登录
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};
