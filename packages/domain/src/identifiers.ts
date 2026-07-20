declare const identifierBrand: unique symbol;

type OpaqueIdentifier<Name extends string> = string & {
  readonly [identifierBrand]: Name;
};

export type WorkspaceId = OpaqueIdentifier<"WorkspaceId">;
export type AccountId = OpaqueIdentifier<"AccountId">;
export type ImportId = OpaqueIdentifier<"ImportId">;
export type TransactionId = OpaqueIdentifier<"TransactionId">;
export type CategoryId = OpaqueIdentifier<"CategoryId">;
export type MerchantId = OpaqueIdentifier<"MerchantId">;
export type AliasId = OpaqueIdentifier<"AliasId">;
export type OperationId = OpaqueIdentifier<"OperationId">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIdentifier<Name extends string>(value: string, label: Name): OpaqueIdentifier<Name> {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a canonical RFC 9562 UUID`);
  }

  return value.toLowerCase() as OpaqueIdentifier<Name>;
}

export const parseWorkspaceId = (value: string): WorkspaceId =>
  parseIdentifier(value, "WorkspaceId");
export const parseAccountId = (value: string): AccountId => parseIdentifier(value, "AccountId");
export const parseImportId = (value: string): ImportId => parseIdentifier(value, "ImportId");
export const parseTransactionId = (value: string): TransactionId =>
  parseIdentifier(value, "TransactionId");
export const parseCategoryId = (value: string): CategoryId => parseIdentifier(value, "CategoryId");
export const parseMerchantId = (value: string): MerchantId => parseIdentifier(value, "MerchantId");
export const parseAliasId = (value: string): AliasId => parseIdentifier(value, "AliasId");
export const parseOperationId = (value: string): OperationId =>
  parseIdentifier(value, "OperationId");
