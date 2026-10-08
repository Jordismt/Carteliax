export default defineNuxtPlugin({
  name: 'session',
  dependsOn: ['supabase'],
  setup() {
  const { $supabase } = useNuxtApp();
  const router = useRouter();
  // Includes sign-out notifications from other tabs. Unmount private page data.
  const { data } = $supabase.auth.onAuthStateChange(event => {
    const middleware = router.currentRoute.value.meta.middleware;
    const requiresAuth = middleware === 'auth' || (Array.isArray(middleware) && middleware.includes('auth'));
    if (event === 'SIGNED_OUT' && requiresAuth) void router.replace('/login');
  });
  if (import.meta.hot) import.meta.hot.dispose(() => data.subscription.unsubscribe());
  },
});
