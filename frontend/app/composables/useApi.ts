type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
};

export function useApi() {
  const { $supabase } = useNuxtApp();
  const config = useRuntimeConfig();

  async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const {
      data: { session },
      error,
    } = await $supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Debes iniciar sesión.");
    }

    try {
    return await $fetch<T, string>(`${config.public.apiUrl}${path}`, {
      method: options.method ?? "GET",
      ...(options.body !== undefined ? { body: options.body } : {}),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    } catch (error: unknown) {
      const e = error as { statusCode?: number; status?: number; data?: { code?: string; businessId?: string } };
      if (import.meta.client && (e.statusCode === 401 || e.status === 401)) await navigateTo("/login", { replace: true });
      if (import.meta.client && (e.statusCode === 402 || e.status === 402) && e.data?.code === "SUBSCRIPTION_REQUIRED" && e.data.businessId) {
        const target = `/billing/${encodeURIComponent(e.data.businessId)}`;
        if (window.location.pathname !== target) await navigateTo(target);
      }
      throw error;
    }
  }

  return { apiFetch };
}
