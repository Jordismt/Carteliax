/** Progressive enhancement: SSR and reduced-motion users always see all content. */
export function useRestaurantMotion(root: Ref<HTMLElement | undefined>) {
  let observer: IntersectionObserver | undefined;
  const revealed = new WeakSet<Element>();
  function observe() {
    observer?.disconnect();
    if (!root.value || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const el = entry.target as HTMLElement;
        if (!revealed.has(el)) { el.dataset.revealed = 'true'; revealed.add(el); }
        observer?.unobserve(el);
      }
    }, { threshold: .08 });
    root.value.querySelectorAll('[data-reveal]').forEach(el => { if (!revealed.has(el)) observer?.observe(el); });
  }
  onMounted(observe);
  onBeforeUnmount(() => observer?.disconnect());
  return { refreshMotion: () => nextTick(observe) };
}
