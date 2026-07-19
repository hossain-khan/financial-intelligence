import {
  MAPPING_VERSION,
  mappingPresetKey,
  type CsvMapping,
  type MappingPreset,
} from "@financial-intelligence/import-core";

export function loadMappingPreset(
  storage: Pick<Storage, "getItem">,
  formatSignature: string,
  parserId: string,
  parserVersion: string,
): MappingPreset | undefined {
  const raw = storage.getItem(mappingPresetKey(formatSignature, parserVersion));
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isPresetMapping(value.mapping)) return undefined;
    if (
      value.schemaVersion !== 1 ||
      value.mappingVersion !== MAPPING_VERSION ||
      value.parserId !== parserId ||
      value.parserVersion !== parserVersion ||
      value.formatSignature !== formatSignature
    ) {
      return undefined;
    }
    return value as unknown as MappingPreset;
  } catch {
    return undefined;
  }
}

export function saveMappingPreset(
  storage: Pick<Storage, "setItem">,
  input: {
    readonly formatSignature: string;
    readonly parserId: string;
    readonly parserVersion: string;
    readonly mapping: CsvMapping;
    readonly now: string;
  },
): MappingPreset {
  const {
    accountId: _accountId,
    accountCurrency: _accountCurrency,
    ...safeMapping
  } = input.mapping;
  const preset: MappingPreset = {
    schemaVersion: 1,
    mappingVersion: MAPPING_VERSION,
    parserId: input.parserId,
    parserVersion: input.parserVersion,
    formatSignature: input.formatSignature,
    mapping: safeMapping,
    confirmedAt: input.now,
  };
  storage.setItem(
    mappingPresetKey(input.formatSignature, input.parserVersion),
    JSON.stringify(preset),
  );
  return preset;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPresetMapping(value: unknown): value is MappingPreset["mapping"] {
  if (!isRecord(value) || !isRecord(value.amount) || !isRecord(value.numberFormat)) return false;
  const amount = value.amount;
  const numberFormat = value.numberFormat;
  const amountValid =
    (amount.kind === "signed" &&
      typeof amount.column === "string" &&
      (amount.positiveDirection === "inflow" || amount.positiveDirection === "outflow")) ||
    (amount.kind === "debit-credit" &&
      typeof amount.debitColumn === "string" &&
      typeof amount.creditColumn === "string" &&
      (amount.debitDirection === "outflow" || amount.debitDirection === "inflow"));
  return (
    amountValid &&
    typeof value.postedDateColumn === "string" &&
    typeof value.descriptionColumn === "string" &&
    Array.isArray(value.ignoredColumns) &&
    value.ignoredColumns.every((column) => typeof column === "string") &&
    ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY/MM/DD"].includes(String(value.dateFormat)) &&
    (numberFormat.decimalSeparator === "." || numberFormat.decimalSeparator === ",") &&
    [".", ",", "space", "none"].includes(String(numberFormat.groupSeparator)) &&
    optionalString(value.transactionDateColumn) &&
    optionalString(value.currencyColumn) &&
    optionalString(value.sourceTransactionIdColumn) &&
    optionalString(value.statusColumn)
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}
