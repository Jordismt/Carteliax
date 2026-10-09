export default defineNuxtPlugin({
  name: 'session',
  dependsOn: ['supabase'],
  setup() {
  const { $supabase } = useNuxtApp();
  const router = useRouter();
  const recoveryUser = useState<string | null>("recovery-user", () => null);
  // Includes sign-out notifications from other tabs. Unmount private page data.
  const { data } = $supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveryUser.value = session?.user.id ?? null;
    if (event === "SIGNED_OUT") recoveryUser.value = null;
    const middleware = router.currentRoute.value.meta.middleware;
    const requiresAuth = middleware === 'auth' || (Array.isArray(middleware) && middleware.includes('auth'));
    if (event === 'SIGNED_OUT' && requiresAuth) void router.replace('/login');
  });
  if (import.meta.hot) import.meta.hot.dispose(() => data.subscription.unsubscribe());
  },
});
