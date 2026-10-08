import type { BusinessSubscription } from "~/composables/useSubscription";

// Informational only. Access decisions remain in useSubscription and the API.
export function useBusinessSubscriptions() {
  const { getSubscription } = useSubscription();
  const subscriptions = ref<Record<string, BusinessSubscription | null | undefined>>({});
  const subscriptionsLoading = ref(false);
  let request = 0;

  async function loadSubscriptions(businessIds: string[]) {
    const current = ++request;
    subscriptionsLoading.value = true;
    const results = await Promise.allSettled(businessIds.map(getSubscription));
    if (current !== request) return;
    subscriptions.value = Object.fromEntries(businessIds.map((id, index) => {
      const result = results[index];
      return [id, result?.status === "fulfilled" ? result.value : undefined];
    }));
    subscriptionsLoading.value = false;
  }

  return { subscriptions, subscriptionsLoading, loadSubscriptions };
}
