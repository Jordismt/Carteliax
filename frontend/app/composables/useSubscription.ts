import { subscriptionHasAccess } from "~/utils/subscriptionAccess";
import { uiError } from "~/utils/uiErrors";
export type SubscriptionStatus =
  | "inactive"
  | "checkout_pending"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface BusinessSubscription {
  id?: string;
  business_id?: string;
  status: SubscriptionStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  trial_used_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  checkout_expires_at?: string | null;
  checkout_session_id?: string | null;
}

interface SubscriptionResponse {
  success: boolean;
  subscription: BusinessSubscription | null;
}

interface StripeSessionResponse {
  success: boolean;
  url: string;
}

export function useSubscription() {
  const { apiFetch } = useApi();

  async function getSubscription(businessId: string): Promise<BusinessSubscription | null> {
    if (!businessId) {
      throw new Error("No se ha indicado el establecimiento.");
    }

    const response = await apiFetch<SubscriptionResponse>(
      `/api/subscriptions/${encodeURIComponent(businessId)}`,
    );

    if (!response.success) {
      throw new Error("No se pudo consultar la suscripción.");
    }

    return response.subscription;
  }

  async function createCheckout(businessId: string): Promise<void> {
    if (!businessId) {
      throw new Error("No se ha indicado el establecimiento.");
    }

    const response = await apiFetch<StripeSessionResponse>("/api/subscriptions/checkout", {
      method: "POST",
      body: { businessId },
    });

    if (!response.success || !response.url) {
      throw new Error("No se pudo crear la sesión de pago.");
    }

    if (!import.meta.client) {
      throw new Error("El pago debe iniciarse desde el navegador.");
    }

    window.location.assign(response.url);
  }

  async function openBillingPortal(businessId: string): Promise<void> {
    if (!businessId) {
      throw new Error("No se ha indicado el establecimiento.");
    }

    const response = await apiFetch<StripeSessionResponse>("/api/subscriptions/portal", {
      method: "POST",
      body: { businessId },
    });

    if (!response.success || !response.url) {
      throw new Error("No se pudo abrir el portal de facturación.");
    }

    if (!import.meta.client) {
      throw new Error("El portal debe abrirse desde el navegador.");
    }

    window.location.assign(response.url);
  }

  async function cancelPendingCheckout(businessId: string): Promise<void> {
    await apiFetch<{success: boolean}>("/api/subscriptions/checkout/cancel", {
      method: "POST", body: { businessId },
    });
  }

  function hasAccess(subscription: BusinessSubscription | null): boolean {
    return subscriptionHasAccess(subscription);
  }

  function canManageBilling(subscription: BusinessSubscription | null): boolean {
    return Boolean(subscription?.stripe_customer_id);
  }

  function canStartCheckout(subscription: BusinessSubscription | null): boolean {
    if (!subscription) {
      return true;
    }

    if (
      subscription.status === "active" ||
      subscription.status === "trialing" ||
      (subscription.status === "checkout_pending" && (!subscription.checkout_expires_at || new Date(subscription.checkout_expires_at).getTime() > Date.now())) ||
      subscription.status === "past_due" ||
      subscription.status === "unpaid" ||
      subscription.status === "paused"
    ) {
      return false;
    }

    if (
      subscription.status === "canceled" ||
      subscription.status === "incomplete_expired" ||
      subscription.status === "inactive" ||
      (subscription.status === "checkout_pending" && !!subscription.checkout_expires_at && new Date(subscription.checkout_expires_at).getTime() <= Date.now())
    ) {
      return true;
    }

    return false;
  }

  function getErrorMessage(error: unknown, fallback = "Ha ocurrido un error."): string {
    return uiError(error, fallback);
  }

  return {
    getSubscription,
    createCheckout,
    cancelPendingCheckout,
    openBillingPortal,
    hasAccess,
    canManageBilling,
    canStartCheckout,
    getErrorMessage,
  };
}
