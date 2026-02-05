import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const stored = localStorage.getItem('visiosport_session');
  if (stored) {
    try {
      const session = JSON.parse(stored);
      const headers: Record<string, string> = {};
      
      if (session.user) {
        headers['X-User-Role'] = session.user.role || 'admin';
        headers['X-User-Id'] = session.user.id || 'demo-user';
        if (session.user.athlete_id) {
          headers['X-Athlete-Id'] = session.user.athlete_id;
        }
      }
      if (session.club) {
        headers['X-Club-Id'] = session.club.id;
      }
      
      return headers;
    } catch {
      return {};
    }
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
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
    // Build URL from query key - first element is the path, subsequent elements may be query params
    let url = queryKey[0] as string;
    
    // If there are additional elements, they may be query parameters (objects) or path segments (strings)
    for (let i = 1; i < queryKey.length; i++) {
      const part = queryKey[i];
      if (typeof part === 'object' && part !== null) {
        // It's a query params object - append as URL search params
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(part)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        const paramString = params.toString();
        if (paramString) {
          url += (url.includes('?') ? '&' : '?') + paramString;
        }
      } else if (typeof part === 'string' || typeof part === 'number') {
        // It's a path segment
        url += '/' + String(part);
      }
    }
    
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
