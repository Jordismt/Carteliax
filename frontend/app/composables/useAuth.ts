export const useAuth = () => {
  const { $supabase } = useNuxtApp();

  const loading = useState("auth-loading", () => false);
  const error = useState<string | null>("auth-error", () => null);

  const register = async (name: string, email: string, password: string) => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: authError } = await $supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (authError) throw authError;

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Error al registrarse";

      return null;
    } finally {
      loading.value = false;
    }
  };

  const login = async (email: string, password: string) => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: authError } = await $supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Error al iniciar sesión";

      return null;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    const { error: authError } = await $supabase.auth.signOut();

    if (authError) throw authError;

    return navigateTo("/login");
  };

  return {
    register,
    login,
    logout,
    loading,
    error,
  };
};
