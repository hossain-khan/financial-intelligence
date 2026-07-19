import {
  AccountValidationError,
  type Account,
  type Workspace,
} from "@financial-intelligence/domain";
import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";

import type { ApplicationServices } from "./infrastructure";
import { getPendingApplicationUpdate, subscribeToApplicationUpdate } from "./pwa";

export interface AppProperties {
  readonly services: ApplicationServices;
}

export function App({ services }: AppProperties) {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppHeader />
        <main id="main-content" className="main-content">
          <Routes>
            <Route path="/" element={<OverviewPage services={services} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <UpdateBanner />
      </div>
    </BrowserRouter>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          FI
        </span>
        <div>
          <p className="brand-name">Financial Intelligence</p>
          <p className="brand-subtitle">Your money. Your device.</p>
        </div>
      </div>
      <nav aria-label="Primary navigation">
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </header>
  );
}

export function OverviewPage({ services }: AppProperties) {
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const result = await services.listWorkspaces.execute();
      setWorkspaces(result);
      setStatus("ready");
    } catch {
      setErrorMessage(
        "The local workspace could not be opened. Your existing data was not changed.",
      );
      setStatus("error");
    }
  }, [services]);

  useEffect(() => {
    let isCurrent = true;

    void services.listWorkspaces
      .execute()
      .then((result) => {
        if (isCurrent) {
          setWorkspaces(result);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (isCurrent) {
          setErrorMessage(
            "The local workspace could not be opened. Your existing data was not changed.",
          );
          setStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [services]);

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("workspaceName");

    if (typeof name !== "string") {
      return;
    }

    setStatus("saving");
    setErrorMessage(undefined);

    try {
      await services.createWorkspace.execute(name);
      form.reset();
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The workspace could not be created.",
      );
      setStatus("error");
    }
  };

  return (
    <div className="page-grid">
      <section className="hero" aria-labelledby="overview-title">
        <div>
          <p className="eyebrow">Private by default</p>
          <h1 id="overview-title">Understand your cash flow without surrendering your data.</h1>
          <p className="hero-copy">
            Import statements, teach your Financial Brain, and trace every insight back to its
            source. Core analysis stays in this browser.
          </p>
        </div>
        <div className="privacy-seal" aria-label="Local processing is enabled">
          <span className="privacy-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Local mode</strong>
            <span>No financial data is being sent anywhere.</span>
          </div>
        </div>
      </section>

      <section className="workspace-panel" aria-labelledby="workspace-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2 id="workspace-title">Create a private workspace</h2>
          </div>
          <span className="storage-chip">Stored in IndexedDB</span>
        </div>

        <Form className="workspace-form" onSubmit={handleCreateWorkspace}>
          <TextField name="workspaceName" isRequired minLength={1} maxLength={120}>
            <Label>Workspace name</Label>
            <div className="input-row">
              <Input placeholder="My household" autoComplete="off" />
              <Button type="submit" isDisabled={status === "saving"}>
                {status === "saving" ? "Creating…" : "Create workspace"}
              </Button>
            </div>
            <FieldError />
          </TextField>
        </Form>

        {errorMessage !== undefined && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        <WorkspaceList workspaces={workspaces} isLoading={status === "loading"} />
      </section>

      {workspaces[0] !== undefined && (
        <AccountsPanel services={services} workspace={workspaces[0]} />
      )}

      <section className="foundation-grid" aria-label="Application foundation">
        <FoundationCard
          number="01"
          title="Import safely"
          copy="CSV mapping, validation, provenance, and duplicate review arrive in the first product milestone."
        />
        <FoundationCard
          number="02"
          title="Rules before AI"
          copy="Confirmed merchant and category rules will run deterministically before any optional model."
        />
        <FoundationCard
          number="03"
          title="Own the learning"
          copy="Your portable Financial Brain will remain human-readable, versioned, and independent of raw history."
        />
      </section>
    </div>
  );
}

function AccountsPanel({ services, workspace }: AppProperties & { readonly workspace: Workspace }) {
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setAccounts(await services.listAccounts.execute(workspace.id));
      setStatus("ready");
    } catch {
      setErrorMessage("Accounts could not be loaded. Your existing data was not changed.");
      setStatus("error");
    }
  }, [services, workspace.id]);

  useEffect(() => {
    let isCurrent = true;
    void services.listAccounts
      .execute(workspace.id)
      .then((result) => {
        if (isCurrent) {
          setAccounts(result);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (isCurrent) {
          setErrorMessage("Accounts could not be loaded. Your existing data was not changed.");
          setStatus("error");
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [services, workspace.id]);

  const runMutation = async (operation: () => Promise<unknown>) => {
    setStatus("saving");
    setErrorMessage(undefined);
    try {
      await operation();
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The account could not be updated.");
      setStatus("error");
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setFieldErrors({});
    setStatus("saving");
    setErrorMessage(undefined);

    try {
      await services.createAccount.execute({
        workspaceId: workspace.id,
        name: String(data.get("name") ?? ""),
        type: String(data.get("type") ?? ""),
        institutionLabel: String(data.get("institutionLabel") ?? ""),
        maskedIdentifier: String(data.get("maskedIdentifier") ?? ""),
        currency: String(data.get("currency") ?? ""),
      });
      form.reset();
      await refresh();
    } catch (error) {
      if (error instanceof AccountValidationError) {
        setFieldErrors({ [error.field]: error.message });
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "The account could not be created.",
        );
      }
      setStatus("error");
    }
  };

  const activeAccounts = accounts.filter((account) => !account.archived);
  const archivedAccounts = accounts.filter((account) => account.archived);

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="account-title">Add a financial account</h2>
        </div>
        <span className="storage-chip">{workspace.name}</span>
      </div>

      <div className="privacy-notice">
        <strong>No bank login or full account number is used.</strong>
        <span>
          Account details stay in this browser. Browser data can be cleared, so encrypted backups
          will be important when backup support arrives.
        </span>
      </div>

      <Form className="account-form" onSubmit={handleCreate} validationErrors={fieldErrors}>
        <TextField name="name" isRequired maxLength={120}>
          <Label>Account name</Label>
          <Input placeholder="Everyday spending" autoComplete="off" />
          <FieldError />
        </TextField>
        <div className="form-field">
          <label htmlFor="account-type">Account type</label>
          <select
            id="account-type"
            name="type"
            defaultValue="checking"
            aria-describedby={fieldErrors.type ? "type-error" : undefined}
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit-card">Credit card</option>
            <option value="cash">Cash</option>
            <option value="loan">Loan</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
          {fieldErrors.type && (
            <span id="type-error" className="field-error">
              {fieldErrors.type}
            </span>
          )}
        </div>
        <TextField name="currency" isRequired minLength={3} maxLength={3} defaultValue="CAD">
          <Label>Currency</Label>
          <Input autoCapitalize="characters" autoComplete="off" aria-describedby="currency-help" />
          <span id="currency-help" className="field-help">
            Uppercase ISO code, such as CAD or USD.
          </span>
          <FieldError />
        </TextField>
        <TextField name="institutionLabel" maxLength={120}>
          <Label>Institution label (optional)</Label>
          <Input placeholder="Community bank" autoComplete="off" />
          <FieldError />
        </TextField>
        <TextField name="maskedIdentifier" maxLength={24}>
          <Label>Masked identifier (optional)</Label>
          <Input placeholder="•••• 1234" autoComplete="off" />
          <span className="field-help">Display hint only. Never enter a full account number.</span>
          <FieldError />
        </TextField>
        <Button type="submit" isDisabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Add account"}
        </Button>
      </Form>

      {errorMessage !== undefined && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      {status === "loading" ? (
        <p className="account-state" aria-live="polite">
          Loading accounts…
        </p>
      ) : accounts.length === 0 ? (
        <p className="account-state">No accounts exist in this workspace yet.</p>
      ) : (
        <div className="account-groups">
          <AccountGroup
            title="Active accounts"
            accounts={activeAccounts}
            emptyCopy="No active accounts."
            pendingDeleteId={pendingDeleteId}
            onRename={(id, name) => runMutation(() => services.renameAccount.execute(id, name))}
            onArchive={(id, archived) =>
              runMutation(() => services.setAccountArchived.execute(id, archived))
            }
            onRequestDelete={setPendingDeleteId}
            onCancelDelete={() => setPendingDeleteId(undefined)}
            onConfirmDelete={(id) =>
              runMutation(async () => {
                await services.requestAccountDeletion.execute(id);
                setPendingDeleteId(undefined);
              })
            }
          />
          <AccountGroup
            title="Archived accounts"
            accounts={archivedAccounts}
            emptyCopy="No archived accounts."
            pendingDeleteId={pendingDeleteId}
            onRename={(id, name) => runMutation(() => services.renameAccount.execute(id, name))}
            onArchive={(id, archived) =>
              runMutation(() => services.setAccountArchived.execute(id, archived))
            }
            onRequestDelete={setPendingDeleteId}
            onCancelDelete={() => setPendingDeleteId(undefined)}
            onConfirmDelete={(id) =>
              runMutation(async () => {
                await services.requestAccountDeletion.execute(id);
                setPendingDeleteId(undefined);
              })
            }
          />
        </div>
      )}
    </section>
  );
}

function AccountGroup({
  title,
  accounts,
  emptyCopy,
  pendingDeleteId,
  onRename,
  onArchive,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  readonly title: string;
  readonly accounts: readonly Account[];
  readonly emptyCopy: string;
  readonly pendingDeleteId: string | undefined;
  readonly onRename: (id: string, name: string) => Promise<unknown>;
  readonly onArchive: (id: string, archived: boolean) => Promise<unknown>;
  readonly onRequestDelete: (id: string) => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: (id: string) => Promise<unknown>;
}) {
  return (
    <section
      className="account-group"
      aria-labelledby={`account-group-${title.replaceAll(" ", "-")}`}
    >
      <h3 id={`account-group-${title.replaceAll(" ", "-")}`}>{title}</h3>
      {accounts.length === 0 ? (
        <p>{emptyCopy}</p>
      ) : (
        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.id}>
              <div className="account-summary">
                <div>
                  <strong>{account.name}</strong>
                  <span>
                    {formatAccountType(account.type)} · {account.currency}
                    {account.maskedIdentifier ? ` · ${account.maskedIdentifier}` : ""}
                  </span>
                </div>
                <span className={account.archived ? "archived-status" : "ready-status"}>
                  {account.archived ? "Archived" : "Active"}
                </span>
              </div>
              <Form
                className="rename-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = new FormData(event.currentTarget).get("accountName");
                  if (typeof name === "string") void onRename(account.id, name);
                }}
              >
                <TextField
                  name="accountName"
                  defaultValue={account.name}
                  isRequired
                  maxLength={120}
                >
                  <Label>Rename {account.name}</Label>
                  <Input />
                  <FieldError />
                </TextField>
                <Button type="submit">Save name</Button>
                <Button type="button" onPress={() => void onArchive(account.id, !account.archived)}>
                  {account.archived ? "Restore" : "Archive"}
                </Button>
                <Button
                  type="button"
                  className="danger-button"
                  onPress={() => onRequestDelete(account.id)}
                >
                  Delete
                </Button>
              </Form>
              {pendingDeleteId === account.id && (
                <div className="delete-confirmation" role="alert">
                  <p>Delete “{account.name}”? Deletion is blocked if any records reference it.</p>
                  <Button
                    className="danger-button"
                    onPress={() => void onConfirmDelete(account.id)}
                  >
                    Confirm delete
                  </Button>
                  <Button onPress={onCancelDelete}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatAccountType(type: Account["type"]): string {
  return type === "credit-card"
    ? "Credit card"
    : `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
}

function WorkspaceList({
  workspaces,
  isLoading,
}: {
  readonly workspaces: readonly Workspace[];
  readonly isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <p className="workspace-state" aria-live="polite">
        Opening local storage…
      </p>
    );
  }

  if (workspaces.length === 0) {
    return <p className="workspace-state">No workspace exists on this device yet.</p>;
  }

  return (
    <ul className="workspace-list" aria-label="Local workspaces">
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <span className="workspace-monogram" aria-hidden="true">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{workspace.name}</strong>
            <span>Local revision {workspace.revision}</span>
          </div>
          <span className="ready-status">Ready</span>
        </li>
      ))}
    </ul>
  );
}

function FoundationCard({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <article className="foundation-card">
      <span>{number}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}

function SettingsPage() {
  return (
    <div className="settings-page">
      <p className="eyebrow">Device settings</p>
      <h1>Privacy and storage</h1>
      <p className="hero-copy">
        Workspaces and account labels are stored only on this device. Statement imports, encrypted
        backups, and optional AI providers will be added behind explicit review and consent flows.
      </p>
      <dl className="settings-list">
        <div>
          <dt>Core processing</dt>
          <dd>Local browser</dd>
        </div>
        <div>
          <dt>Remote AI</dt>
          <dd>Off</dd>
        </div>
        <div>
          <dt>Telemetry</dt>
          <dd>None</dd>
        </div>
        <div>
          <dt>Backup</dt>
          <dd>Not configured</dd>
        </div>
      </dl>
    </div>
  );
}

function UpdateBanner() {
  const pendingUpdate = useSyncExternalStore(
    subscribeToApplicationUpdate,
    getPendingApplicationUpdate,
    getPendingApplicationUpdate,
  );

  if (pendingUpdate === undefined) {
    return null;
  }

  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <Button onPress={() => void pendingUpdate()}>Update safely</Button>
    </div>
  );
}
