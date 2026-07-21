/**
 * The minimal slice of the pdfjs-dist API this package depends on. Declaring it locally keeps the
 * extractor testable with a lightweight fake and documents exactly which PDF.js surface we rely on,
 * so an upgrade that changes anything outside this shape is caught at the boundary.
 */
export interface PdfjsTextItem {
  readonly str?: string;
  readonly transform?: readonly number[];
  readonly width?: number;
  readonly height?: number;
}

export interface PdfjsTextContent {
  readonly items: readonly (PdfjsTextItem | Record<string, unknown>)[];
}

export interface PdfjsViewport {
  readonly width: number;
  readonly height: number;
}

export interface PdfjsPage {
  getViewport(params: { scale: number }): PdfjsViewport;
  getTextContent(): Promise<PdfjsTextContent>;
}

export interface PdfjsDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPage>;
  getMetadata(): Promise<{ readonly info?: Record<string, unknown> }>;
}

export interface PdfjsLoadingTask {
  promise: Promise<PdfjsDocument>;
  onPassword?: (updatePassword: (password: string | Error) => void, reason: number) => void;
  destroy(): Promise<void>;
}

/** Options we pass to `getDocument`; only the security-relevant subset is modeled. */
export interface PdfjsGetDocumentParameters {
  readonly data: Uint8Array;
  readonly isEvalSupported: false;
  readonly useWorkerFetch: false;
  readonly disableFontFace: true;
  readonly useSystemFonts: false;
  readonly stopAtErrors: true;
}

export interface PdfjsModule {
  getDocument(params: PdfjsGetDocumentParameters): PdfjsLoadingTask;
  readonly PasswordException?: new (...args: never[]) => Error;
}

/** The hardened, no-network, no-eval configuration applied to every document we open. */
export function hardenedGetDocumentParameters(data: Uint8Array): PdfjsGetDocumentParameters {
  return {
    data,
    // Defense in depth against CVE-2024-4367-style eval font execution.
    isEvalSupported: false,
    // Never let the worker fetch CMaps, standard fonts, or wasm over the network.
    useWorkerFetch: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
  };
}
