import type { SourceFileMetadata } from "@financial-intelligence/import-core";

export interface SourceMetadataInput {
  readonly fileName: string;
  readonly mediaType: string;
  readonly bytes: ArrayBuffer;
}

export async function computeSourceFileMetadata(
  input: SourceMetadataInput,
): Promise<SourceFileMetadata> {
  const digest = await crypto.subtle.digest("SHA-256", input.bytes);
  return {
    fileName: input.fileName,
    mediaType: input.mediaType,
    byteSize: input.bytes.byteLength,
    sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}
