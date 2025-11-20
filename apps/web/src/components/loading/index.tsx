import { cn } from "@/lib/utils";
import { LoadingOutlined } from "@ant-design/icons";

interface ILoadingProps {
  size?: "small" | "medium" | "large";
  fullScreen?: boolean;
}

export const Loading = ({
  size = "medium",
  fullScreen = false,
}: ILoadingProps) => {
  const iconSizeMap = {
    small: 16,
    medium: 24,
    large: 32,
  };

  const textSizeMap = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2",
        fullScreen && "fixed inset-0 z-50 h-screen w-screen",
      )}
    >
      <LoadingOutlined size={iconSizeMap[size]} />
      <span className={textSizeMap[size]}>Loading...</span>
    </div>
  );
};
