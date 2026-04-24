export type ToastVariant = 'error' | 'success' | 'info';

export type ToastDetail = { message: string; variant: ToastVariant };

const EVT = 'linearize-toast';

export function pushToast(message: string, variant: ToastVariant = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVT, { detail: { message, variant } }));
}

export const TOAST_EVENT = EVT;
