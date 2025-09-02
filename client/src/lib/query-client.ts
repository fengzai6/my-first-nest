import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

// queryClient.defaultMutationOptions({
//   onError: (error) => {
//     toast.error(error.message);
//   }
// })

export default queryClient;
