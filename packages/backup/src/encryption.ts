import { ManifestValidationError, webCryptoDigest } from "./manifest";
import {
  BackupValidationError,
  MAX_BACKUP_BYTES,
  buildSnapshotWithManifest,
  parseSnapshot,
  previewSnapshot,
  serializeSnapshot,
  verifySnapshotManifest,
  type WorkspaceBackupPreview,
  type WorkspaceBackupSnapshot,
} from "./snapshot";

export const ENCRYPTED_BACKUP_FORMAT = "financial-intelligence.encrypted-backup";
export const ENCRYPTED_BACKUP_VERSION = "1.0.0";
export const ENCRYPTED_BACKUP_MEDIA_TYPE =
  "application/vnd.financial-intelligence.encrypted-backup+json";

export interface Argon2idParameters {
  readonly name: "Argon2id";
  readonly version: 19;
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly hashLength: 32;
}

export const DEFAULT_ARGON2ID_PARAMETERS: Argon2idParameters = {
  name: "Argon2id",
  version: 19,
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
};

interface EncryptedBackupHeader {
  readonly format: typeof ENCRYPTED_BACKUP_FORMAT;
  readonly version: typeof ENCRYPTED_BACKUP_VERSION;
  readonly createdAt: string;
  readonly payload: {
    readonly format: string;
    readonly version: string;
    readonly encoding: "utf-8";
    readonly byteLength: number;
  };
  readonly kdf: Argon2idParameters & { readonly salt: string };
  readonly cipher: {
    readonly name: "AES-GCM";
    readonly keyLength: 256;
    readonly nonce: string;
    readonly tagLength: 128;
  };
}

export type EncryptedBackupContainer = EncryptedBackupHeader & { readonly ciphertext: string };

export class EncryptedBackupError extends Error {
  public constructor(
    public readonly code:
      | "INVALID_CONTAINER"
      | "UNSUPPORTED_VERSION"
      | "DECRYPTION_FAILED"
      | "INVALID_PAYLOAD"
      | "RESOURCE_LIMIT",
  ) {
    super(code);
    this.name = "EncryptedBackupError";
  }
}

export async function encryptWorkspaceBackup(
  input: WorkspaceBackupSnapshot | Omit<WorkspaceBackupSnapshot, "manifest">,
  passphrase: string,
  options: {
    readonly crypto?: Crypto;
    readonly parameters?: Argon2idParameters;
    readonly buildId?: string;
  } = {},
): Promise<string> {
  validatePassphrase(passphrase);
  const cryptoProvider = options.crypto ?? crypto;
  const parameters = options.parameters ?? DEFAULT_ARGON2ID_PARAMETERS;
  validateParameters(parameters);
  // Build the authenticated manifest here when the caller has not already attached one, so every
  // produced backup carries verified per-section digests regardless of the call site.
  const snapshot: WorkspaceBackupSnapshot =
    "manifest" in input && input.manifest !== undefined
      ? input
      : await buildSnapshotWithManifest(input, { buildId: options.buildId ?? "unknown" }, (bytes) =>
          webCryptoDigest(bytes, cryptoProvider),
        );
  const plaintext = serializeSnapshot(snapshot);
  const salt = cryptoProvider.getRandomValues(new Uint8Array(16));
  const nonce = cryptoProvider.getRandomValues(new Uint8Array(12));
  const header: EncryptedBackupHeader = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    payload: {
      format: snapshot.format,
      version: snapshot.version,
      encoding: "utf-8",
      byteLength: plaintext.byteLength,
    },
    kdf: { ...parameters, salt: toBase64Url(salt) },
    cipher: {
      name: "AES-GCM",
      keyLength: 256,
      nonce: toBase64Url(nonce),
      tagLength: 128,
    },
  };
  const key = await deriveKey(passphrase, salt, parameters, cryptoProvider);
  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await cryptoProvider.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: webCryptoBytes(nonce),
        additionalData: encodeHeader(header),
        tagLength: 128,
      },
      key,
      webCryptoBytes(plaintext),
    );
  } finally {
    plaintext.fill(0);
  }
  return JSON.stringify({ ...header, ciphertext: toBase64Url(new Uint8Array(ciphertext)) });
}

/**
 * Decrypt, parse, and fully validate a backup into a snapshot, verifying the authenticated manifest.
 * This is the single trusted entry point used by both preview (metadata only) and restore staging;
 * wrong passphrase and tampering are indistinguishable `DECRYPTION_FAILED` failures.
 */
export async function decryptWorkspaceBackup(
  content: string,
  passphrase: string,
  options: { readonly crypto?: Crypto } = {},
): Promise<WorkspaceBackupSnapshot> {
  validatePassphrase(passphrase);
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES * 2) {
    throw new EncryptedBackupError("RESOURCE_LIMIT");
  }
  const container = parseContainer(content);
  const cryptoProvider = options.crypto ?? crypto;
  let plaintext: ArrayBuffer;
  try {
    const salt = fromBase64Url(container.kdf.salt, 16);
    const nonce = fromBase64Url(container.cipher.nonce, 12);
    const ciphertext = fromBase64Url(container.ciphertext);
    if (ciphertext.byteLength < 17 || ciphertext.byteLength > MAX_BACKUP_BYTES + 16) {
      throw new EncryptedBackupError("RESOURCE_LIMIT");
    }
    const { ciphertext: _ciphertext, ...header } = container;
    const key = await deriveKey(passphrase, salt, container.kdf, cryptoProvider);
    plaintext = await cryptoProvider.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: webCryptoBytes(nonce),
        additionalData: encodeHeader(header),
        tagLength: container.cipher.tagLength,
      },
      key,
      webCryptoBytes(ciphertext),
    );
  } catch (error) {
    if (error instanceof EncryptedBackupError && error.code === "RESOURCE_LIMIT") throw error;
    throw new EncryptedBackupError("DECRYPTION_FAILED");
  }
  const bytes = new Uint8Array(plaintext);
  try {
    if (bytes.byteLength !== container.payload.byteLength) {
      throw new EncryptedBackupError("INVALID_PAYLOAD");
    }
    const snapshot = parseSnapshot(bytes);
    if (
      snapshot.format !== container.payload.format ||
      snapshot.version !== container.payload.version
    ) {
      throw new EncryptedBackupError("INVALID_PAYLOAD");
    }
    // The manifest is authenticated (it lives inside the AES-GCM payload); verifying its per-section
    // counts and digests turns a partially-written or internally-inconsistent backup into a clean
    // failure before any metadata is trusted or any restore staging begins.
    await verifySnapshotManifest(snapshot, (input) => webCryptoDigest(input, cryptoProvider));
    return snapshot;
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      throw new EncryptedBackupError("INVALID_PAYLOAD");
    }
    if (error instanceof BackupValidationError) {
      throw new EncryptedBackupError(
        error.code === "RESOURCE_LIMIT"
          ? "RESOURCE_LIMIT"
          : error.code === "UNSUPPORTED_VERSION"
            ? "UNSUPPORTED_VERSION"
            : "INVALID_PAYLOAD",
      );
    }
    if (error instanceof EncryptedBackupError) throw error;
    throw new EncryptedBackupError("INVALID_PAYLOAD");
  } finally {
    bytes.fill(0);
  }
}

export async function previewEncryptedWorkspaceBackup(
  content: string,
  passphrase: string,
  options: { readonly crypto?: Crypto } = {},
): Promise<WorkspaceBackupPreview> {
  const snapshot = await decryptWorkspaceBackup(content, passphrase, options);
  return previewSnapshot(snapshot);
}

function parseContainer(content: string): EncryptedBackupContainer {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new EncryptedBackupError("INVALID_CONTAINER");
  }
  if (!isObject(value) || value.format !== ENCRYPTED_BACKUP_FORMAT) invalidContainer();
  if (value.version !== ENCRYPTED_BACKUP_VERSION) {
    throw new EncryptedBackupError("UNSUPPORTED_VERSION");
  }
  if (!isObject(value.payload) || !isObject(value.kdf) || !isObject(value.cipher)) {
    invalidContainer();
  }
  if (
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    value.payload.encoding !== "utf-8" ||
    !Number.isSafeInteger(value.payload.byteLength) ||
    (value.payload.byteLength as number) < 1 ||
    value.kdf.name !== "Argon2id" ||
    value.kdf.version !== 19 ||
    value.kdf.hashLength !== 32 ||
    value.cipher.name !== "AES-GCM" ||
    value.cipher.keyLength !== 256 ||
    value.cipher.tagLength !== 128 ||
    typeof value.kdf.salt !== "string" ||
    typeof value.cipher.nonce !== "string" ||
    typeof value.ciphertext !== "string"
  )
    invalidContainer();
  validateParameters(value.kdf as unknown as Argon2idParameters);
  return value as unknown as EncryptedBackupContainer;
}

function validateParameters(value: Argon2idParameters): void {
  if (
    value.name !== "Argon2id" ||
    value.version !== 19 ||
    value.hashLength !== 32 ||
    value.memoryKiB < 19_456 ||
    value.memoryKiB > 65_536 ||
    value.iterations < 2 ||
    value.iterations > 6 ||
    value.parallelism < 1 ||
    value.parallelism > 4
  )
    invalidContainer();
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  parameters: Argon2idParameters,
  cryptoProvider: Crypto,
): Promise<CryptoKey> {
  const { argon2id } = await import("hash-wasm");
  const derived = await argon2id({
    password: passphrase,
    salt,
    parallelism: parameters.parallelism,
    iterations: parameters.iterations,
    memorySize: parameters.memoryKiB,
    hashLength: parameters.hashLength,
    outputType: "binary",
  });
  try {
    return await cryptoProvider.subtle.importKey("raw", webCryptoBytes(derived), "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  } finally {
    derived.fill(0);
  }
}

function encodeHeader(header: EncryptedBackupHeader): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(header));
}

function webCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function validatePassphrase(value: string): void {
  if (value.length < 12 || value.length > 1_024) {
    throw new EncryptedBackupError("INVALID_CONTAINER");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidContainer(): never {
  throw new EncryptedBackupError("INVALID_CONTAINER");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string, exactLength?: number): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) invalidContainer();
  try {
    const padded = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (exactLength !== undefined && bytes.byteLength !== exactLength) invalidContainer();
    return bytes;
  } catch {
    invalidContainer();
  }
}
