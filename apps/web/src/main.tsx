import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { applicationServices } from "./infrastructure";
import { registerApplicationServiceWorker } from "./pwa";
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

registerApplicationServiceWorker();
