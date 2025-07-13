import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="space-y-6 text-center">
        <h1 className="text-9xl font-extrabold tracking-tighter text-primary">
          404
        </h1>
        <h2 className="text-3xl font-bold tracking-tight">页面未找到</h2>
        <p className="mx-auto max-w-md text-muted-foreground">
          抱歉，您访问的页面不存在或禁止访问。请检查URL是否正确。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="min-w-[120px]"
          >
            返回上一页
          </Button>
          <Button onClick={() => navigate("/")} className="min-w-[120px]">
            返回主页
          </Button>
        </div>
      </div>
    </div>
  );
};
