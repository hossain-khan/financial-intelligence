import {
  activeProtectedOperations,
  isProtectedOperationActive,
  subscribeToProtectedOperations,
  type ProtectedOperationKind,
} from "./protected-operations";

/**
 * Explicit service-worker lifecycle states. The application never force-reloads: an update is
 * downloaded in the background (`update-available`), applied only after the user confirms at a safe
 * boundary (`activating` → `reload-required`), and deferred while a protected operation is running.
 *
 * - `checking`        — registration in progress, no worker controlling yet.
 * - `ready`           — a worker controls the page and the app is current.
 * - `offline-ready`   — assets are precached; the app works with no network.
 * - `update-available`— a new worker is installed and waiting; user action required.
 * - `activating`      — the user confirmed; the waiting worker was told to take over.
 * - `reload-required` — the new worker is active; the page (and other tabs) must reload once.
 * - `failed`          — registration or activation failed; the current version keeps working.
 */
export type PwaLifecycleState =
  | "checking"
  | "ready"
  | "offline-ready"
  | "update-available"
  | "activating"
  | "reload-required"
  | "failed";

export interface PwaStatus {
  readonly state: PwaLifecycleState;
  /** True while an update is available but a protected operation blocks safe activation. */
  readonly updateDeferred: boolean;
  readonly blockingOperations: readonly ProtectedOperationKind[];
  /** Build identifier of the running app, surfaced in Settings. */
  readonly buildId: string;
  readonly supported: boolean;
  readonly message?: string;
}

/**
 * The registration surface the controller depends on. `vite-plugin-pwa`'s `registerSW` is adapted
 * to this shape in `register.ts`; tests provide a fake so the state machine can be exercised with no
 * real service worker.
 */
export interface ServiceWorkerRegistrationPort {
  register(callbacks: {
    onNeedRefresh: () => void;
    onOfflineReady: () => void;
    onRegisterError: (error: unknown) => void;
  }): void;
  /** Tell the waiting worker to activate. Resolves once activation has been requested. */
  activate(): Promise<void>;
  readonly supported: boolean;
}

/** Cross-tab channel so one tab's activation decision reaches the others. */
export interface BroadcastPort {
  post(message: PwaBroadcastMessage): void;
  subscribe(listener: (message: PwaBroadcastMessage) => void): () => void;
}

export type PwaBroadcastMessage =
  | { readonly type: "reload-required"; readonly buildId: string }
  | { readonly type: "update-available"; readonly buildId: string };

export interface PwaControllerDependencies {
  readonly registration: ServiceWorkerRegistrationPort;
  readonly broadcast?: BroadcastPort;
  readonly buildId: string;
  /** Perform the one-time page reload after activation. Injected for tests. */
  readonly reload: () => void;
}

type Listener = () => void;

/**
 * Owns the PWA lifecycle state and the safe-activation policy. A single instance is created at app
 * start (`register.ts`); React subscribes through `useSyncExternalStore`.
 */
export class PwaController {
  private status: PwaStatus;
  private readonly listeners = new Set<Listener>();
  private readonly deps: PwaControllerDependencies;
  private activationRequested = false;
  private disposeProtected: (() => void) | undefined;
  private disposeBroadcast: (() => void) | undefined;

  public constructor(deps: PwaControllerDependencies) {
    this.deps = deps;
    this.status = {
      state: deps.registration.supported ? "checking" : "failed",
      updateDeferred: false,
      blockingOperations: [],
      buildId: deps.buildId,
      supported: deps.registration.supported,
      ...(deps.registration.supported
        ? {}
        : { message: "This browser does not support offline mode; the app still works online." }),
    };
  }

  public start(): void {
    if (!this.deps.registration.supported) return;

    this.deps.registration.register({
      onNeedRefresh: () => this.handleUpdateAvailable(),
      onOfflineReady: () => this.handleOfflineReady(),
      onRegisterError: (error) => this.handleRegisterError(error),
    });

    // When a protected operation ends, a previously-deferred activation can proceed.
    this.disposeProtected = subscribeToProtectedOperations(() => {
      this.refreshDeferral();
      if (this.status.state === "update-available" && this.activationRequested) {
        void this.confirmUpdate();
      }
    });

    // Another tab may have activated an update; this tab must reload to match.
    this.disposeBroadcast = this.deps.broadcast?.subscribe((message) => {
      if (message.type === "reload-required" && message.buildId !== this.deps.buildId) {
        this.set({ state: "reload-required" });
      } else if (message.type === "update-available" && this.status.state === "ready") {
        this.set({ state: "update-available" });
      }
    });
  }

  public dispose(): void {
    this.disposeProtected?.();
    this.disposeBroadcast?.();
  }

  public getStatus = (): PwaStatus => this.status;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * User confirmed the update at a safe boundary. If a protected operation is active, the request is
   * remembered and applied automatically once the operation completes; otherwise activation starts
   * now.
   */
  public async confirmUpdate(): Promise<void> {
    if (this.status.state !== "update-available") return;
    this.activationRequested = true;
    if (isProtectedOperationActive()) {
      this.refreshDeferral();
      return;
    }
    this.set({ state: "activating", updateDeferred: false, blockingOperations: [] });
    try {
      this.deps.broadcast?.post({ type: "reload-required", buildId: this.deps.buildId });
      await this.deps.registration.activate();
      this.set({ state: "reload-required" });
      this.deps.reload();
    } catch (error) {
      this.set({
        state: "failed",
        message: safeMessage(
          error,
          "The update could not be applied. The current version still works.",
        ),
      });
    }
  }

  private handleUpdateAvailable(): void {
    this.deps.broadcast?.post({ type: "update-available", buildId: this.deps.buildId });
    this.set({ state: "update-available" });
    this.refreshDeferral();
  }

  private handleOfflineReady(): void {
    if (this.status.state === "checking") this.set({ state: "offline-ready" });
  }

  private handleRegisterError(error: unknown): void {
    this.set({
      state: "failed",
      message: safeMessage(error, "Offline mode could not be enabled. The app still works online."),
    });
  }

  private refreshDeferral(): void {
    if (this.status.state !== "update-available") return;
    const blocking = activeProtectedOperations();
    this.set({ updateDeferred: blocking.length > 0, blockingOperations: blocking });
  }

  private set(partial: Partial<PwaStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) listener();
  }
}

function safeMessage(error: unknown, fallback: string): string {
  // Never surface raw error text (may contain paths/URLs); use a bounded, sanitized message.
  void error;
  return fallback;
}
