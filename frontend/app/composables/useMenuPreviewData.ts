import type { PreviewCategory, PreviewProduct } from '~/types/menuTheme';
/** Read the same visible categories, available products and allergen relations as the editor. */
export function useMenuPreviewData() {
  const { apiFetch } = useApi();
  async function load(menuId: string): Promise<PreviewCategory[]> {
    const { categories } = await apiFetch<{ categories: { id: string; name: string; is_visible: boolean; sort_order: number }[] }>(`/api/menus/${menuId}/categories`);
    const rows = await Promise.all(categories.filter(c => c.is_visible).sort((a,b) => a.sort_order-b.sort_order).map(async category => {
      const { products } = await apiFetch<{ products: (Omit<PreviewProduct, 'allergens'> & { sort_order: number })[] }>(`/api/categories/${category.id}/products`);
      return { category, products: products.filter(p => p.is_available).sort((a,b) => a.sort_order-b.sort_order) };
    }));
    const ids = [...new Set(rows.flatMap(row => row.products.map(p => p.id)))];
    const names = new Map<string, string[]>();
    if (ids.length) {
      const { allergens } = await apiFetch<{ allergens: { id: number; name_es: string }[] }>('/api/allergens');
      const catalog = new Map(allergens.map(a => [a.id, a.name_es]));
      await Promise.all(ids.map(async id => {
        const { allergenIds } = await apiFetch<{ allergenIds: number[] }>(`/api/products/${id}/allergens`);
        names.set(id, allergenIds.map(a => catalog.get(a)).filter((name): name is string => !!name));
      }));
    }
    return rows.map(({ category, products }) => ({ id: category.id, name: category.name, products: products.map(p => ({ ...p, price: Number(p.price), description: p.description || '', allergens: names.get(p.id) || [] })) }));
  }
  return { loadMenuPreview: load };
}
