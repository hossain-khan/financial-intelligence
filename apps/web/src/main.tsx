import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { applicationServices } from "./infrastructure";
import { initInstallAffordance } from "./pwa/install";
import { registerApplicationServiceWorker } from "./pwa/register";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Application root was not found");
}

createRoot(root).render(
  <StrictMode>
    <App services={applicationServices} />
  </StrictMode>,
);

initInstallAffordance();
registerApplicationServiceWorker();
