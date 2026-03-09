import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// BUG-019 fix: Include tenant_id and auth token headers in all API requests
function getDefaultHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = localStorage.getItem("waste_app_tenant_id");
  const token = localStorage.getItem("waste_app_token");
  if (tenantId) headers["x-tenant-id"] = tenantId;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const defaultHeaders = getDefaultHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...defaultHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const defaultHeaders = getDefaultHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: defaultHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // BUG-020 fix: Properly check for 4xx status codes instead of just character '4'
        if (error instanceof Error) {
          const match = error.message.match(/^(\d{3}):/);
          if (match) {
            const statusCode = parseInt(match[1]);
            if (statusCode >= 400 && statusCode < 500) return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // BUG-020 fix: Same proper status code check
        if (error instanceof Error) {
          const match = error.message.match(/^(\d{3}):/);
          if (match) {
            const statusCode = parseInt(match[1]);
            if (statusCode >= 400 && statusCode < 500) return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});
