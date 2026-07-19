interface RegisterServiceWorkerOptions {
  readonly immediate?: boolean;
  readonly onNeedRefresh?: () => void;
}

export function registerSW(
  _options?: RegisterServiceWorkerOptions,
): (_reloadPage?: boolean) => Promise<void> {
  return async () => undefined;
}
