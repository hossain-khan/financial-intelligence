/**
 * Install-affordance state. The `beforeinstallprompt` event is Chromium-only; we surface a real
 * install button only when it fires, and otherwise fall back to accurate per-platform instructions
 * (Safari/iOS "Add to Home Screen"). We never claim universal install support.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | undefined;
let installed = false;
const listeners = new Set<Listener>();

/** Begin listening for install-related browser events. Safe to call once at startup. */
export function initInstallAffordance(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = undefined;
    emit();
  });
}

export function subscribeToInstallAffordance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== undefined;
}

export function isProbablyInstalled(): boolean {
  if (installed) return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Trigger the native install prompt. Returns the user's choice, or "unavailable". */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (deferredPrompt === undefined) return "unavailable";
  const event = deferredPrompt;
  deferredPrompt = undefined;
  emit();
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}

function emit(): void {
  for (const listener of listeners) listener();
}
