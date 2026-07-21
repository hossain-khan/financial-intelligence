/**
 * A protected operation is a staged, non-atomic user action — an import commit, a bulk edit, a
 * backup, a restore, a migration — during which a service-worker activation and page reload could
 * strand or corrupt in-flight work. Code enters a protected region while such an operation runs; the
 * update controller refuses to activate a new worker until every region has exited.
 *
 * This is a simple counted registry rather than a lock: nested/concurrent operations each hold the
 * region, and the guard clears only when the count returns to zero. It never blocks the operation
 * itself — it only defers the *reload*, which is always safe to postpone.
 */
export type ProtectedOperationKind =
  "import-commit" | "bulk-edit" | "backup" | "restore" | "migration" | "brain-apply";

type Listener = (active: boolean) => void;

const active = new Map<ProtectedOperationKind, number>();
const listeners = new Set<Listener>();

/**
 * Mark a protected region as active and return a release function. Always release in a `finally` so
 * a thrown operation cannot leave the guard stuck. Releasing more than once is a no-op.
 */
export function beginProtectedOperation(kind: ProtectedOperationKind): () => void {
  active.set(kind, (active.get(kind) ?? 0) + 1);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (active.get(kind) ?? 1) - 1;
    if (next <= 0) active.delete(kind);
    else active.set(kind, next);
    emit();
  };
}

/** Run `operation` inside a protected region, releasing even if it throws. */
export async function withProtectedOperation<T>(
  kind: ProtectedOperationKind,
  operation: () => Promise<T>,
): Promise<T> {
  const release = beginProtectedOperation(kind);
  try {
    return await operation();
  } finally {
    release();
  }
}

/** Whether any protected operation is currently in progress. */
export function isProtectedOperationActive(): boolean {
  return active.size > 0;
}

/** The kinds currently active, for surfacing "why can't I update yet" to the user. */
export function activeProtectedOperations(): readonly ProtectedOperationKind[] {
  return [...active.keys()];
}

/** Subscribe to changes in whether any protected operation is active. */
export function subscribeToProtectedOperations(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  const state = active.size > 0;
  for (const listener of listeners) listener(state);
}
