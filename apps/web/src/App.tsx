import type { Workspace } from "@financial-intelligence/domain";
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
        The initial foundation stores workspaces only on this device. Statement imports, encrypted
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
