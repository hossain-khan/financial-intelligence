import { registerSW } from "virtual:pwa-register";

type UpdateListener = () => void;
type ApplyUpdate = () => Promise<void>;

const listeners = new Set<UpdateListener>();
let pendingUpdate: ApplyUpdate | undefined;

export function registerApplicationServiceWorker(): void {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = async () => updateServiceWorker(true);
      emitChange();
    },
  });
}

export function subscribeToApplicationUpdate(listener: UpdateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingApplicationUpdate(): ApplyUpdate | undefined {
  return pendingUpdate;
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}
