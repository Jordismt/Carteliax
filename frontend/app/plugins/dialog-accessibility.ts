import type { ObjectDirective } from "vue";

type DialogElement = HTMLElement & { cleanupDialog?: () => void };

export default defineNuxtPlugin((nuxtApp) => {
  const directive: ObjectDirective<DialogElement, () => void> = {
    mounted(element, binding) {
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const previousOverflow = document.body.style.overflow;
      const focusable = () => [...element.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      )].filter((item) => item.getClientRects().length > 0);
      element.tabIndex = -1;
      document.body.style.overflow = "hidden";
      const frame = requestAnimationFrame(() => {
        // Respect a field the user already chose during the opening frame.
        if (element.contains(document.activeElement)) return;
        (element.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="file"]):not(:disabled), textarea:not(:disabled)') ?? focusable()[0] ?? element).focus();
      });
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          binding.value();
        }
        if (event.key !== "Tab") return;
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) { event.preventDefault(); element.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
          event.preventDefault(); first.focus();
        }
      };
      element.addEventListener("keydown", onKeydown);
      element.cleanupDialog = () => {
        cancelAnimationFrame(frame);
        element.removeEventListener("keydown", onKeydown);
        document.body.style.overflow = previousOverflow;
        if (previous?.isConnected) previous.focus();
      };
    },
    unmounted(element) { element.cleanupDialog?.(); },
    getSSRProps() { return {}; },
  };
  nuxtApp.vueApp.directive("dialog-accessibility", directive);
});
