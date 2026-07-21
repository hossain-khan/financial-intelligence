// The pdfjs-dist legacy deep-import paths ship no bundled type declarations; we access them only
// through the local `PdfjsModule` shape in `pdfjs.ts`, so an untyped module declaration suffices.
declare module "pdfjs-dist/legacy/build/pdf.mjs";
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
