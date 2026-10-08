export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const { $supabase } = useNuxtApp();

  const {
    data: { session },
    error,
  } = await $supabase.auth.getSession();


  if (!session) {
    return navigateTo("/login");
  }

  const {
    data: { user },
    error: userError,
  } = await $supabase.auth.getUser();


  if (userError || !user) {
    return navigateTo("/login");
  }
});
