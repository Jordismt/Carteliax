import type { MenuTheme, MenuThemeResponse } from "~/types/menuTheme";

export function useMenuTheme() {
  const { apiFetch } = useApi();

  async function getTheme(menuId: string): Promise<MenuThemeResponse> {
    return apiFetch<MenuThemeResponse>(`/api/menus/${menuId}/theme`);
  }

  async function saveDraft(menuId: string, theme: MenuTheme): Promise<MenuThemeResponse> {
    return apiFetch<MenuThemeResponse>(`/api/menus/${menuId}/theme`, {
      method: "PUT",
      body: JSON.parse(JSON.stringify(theme)),
    });
  }

  async function publishTheme(menuId: string): Promise<MenuThemeResponse> {
    return apiFetch<MenuThemeResponse>(`/api/menus/${menuId}/theme/publish`, {
      method: "POST",
    });
  }

  async function resetTheme(menuId: string): Promise<MenuThemeResponse> {
    return apiFetch<MenuThemeResponse>(`/api/menus/${menuId}/theme/reset`, {
      method: "POST",
    });
  }

  return {
    getTheme,
    saveDraft,
    publishTheme,
    resetTheme,
  };
}
