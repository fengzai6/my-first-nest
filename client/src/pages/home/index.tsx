import { useUserStore } from "@/stores/user";

export const Home = () => {
  const user = useUserStore((state) => state.user);

  return (
    <div className="flex-1">
      <h1 className="text-2xl font-bold">Home</h1>
      <div className="text-lg">Hello, {user?.username}</div>
    </div>
  );
};
