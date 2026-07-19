import type { AccountId, WorkspaceId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit-card",
  "cash",
  "loan",
  "investment",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountField = "name" | "type" | "institutionLabel" | "maskedIdentifier" | "currency";

export class AccountValidationError extends RangeError {
  public constructor(
    public readonly field: AccountField,
    message: string,
  ) {
    super(message);
    this.name = "AccountValidationError";
  }
}

export class AccountCurrencyLockedError extends Error {
  public constructor() {
    super("Account currency cannot be changed after transactions exist");
    this.name = "AccountCurrencyLockedError";
  }
}

export interface Account {
  readonly id: AccountId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly type: AccountType;
  readonly institutionLabel?: string;
  readonly maskedIdentifier?: string;
  readonly currency: string;
  readonly archived: boolean;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface CreateAccountInput {
  readonly id: AccountId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly type: string;
  readonly institutionLabel?: string;
  readonly maskedIdentifier?: string;
  readonly currency: string;
  readonly now: UtcTimestamp;
}

// Active ISO 4217 alphabetic codes. Keeping this deterministic avoids locale/runtime differences.
const ISO_4217_CODES = new Set(
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG".split(
    " ",
  ),
);

export function createAccount(input: CreateAccountInput): Account {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: parseAccountName(input.name),
    type: parseAccountType(input.type),
    ...optionalText("institutionLabel", input.institutionLabel, 120),
    ...optionalText("maskedIdentifier", input.maskedIdentifier, 24),
    currency: parseCurrency(input.currency),
    archived: false,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function renameAccount(account: Account, name: string, now: UtcTimestamp): Account {
  return { ...account, name: parseAccountName(name), updatedAt: now };
}

export function setAccountArchived(
  account: Account,
  archived: boolean,
  now: UtcTimestamp,
): Account {
  return { ...account, archived, updatedAt: now };
}

export function changeAccountCurrency(
  account: Account,
  currency: string,
  hasTransactions: boolean,
  now: UtcTimestamp,
): Account {
  const nextCurrency = parseCurrency(currency);
  if (hasTransactions && nextCurrency !== account.currency) {
    throw new AccountCurrencyLockedError();
  }
  return nextCurrency === account.currency
    ? account
    : { ...account, currency: nextCurrency, updatedAt: now };
}

function parseAccountName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 120) {
    throw new AccountValidationError(
      "name",
      "Account name must contain between 1 and 120 characters",
    );
  }
  return name;
}

function parseAccountType(value: string): AccountType {
  if (!ACCOUNT_TYPES.includes(value as AccountType)) {
    throw new AccountValidationError("type", "Choose a supported account type");
  }
  return value as AccountType;
}

function parseCurrency(value: string): string {
  if (!ISO_4217_CODES.has(value)) {
    throw new AccountValidationError("currency", "Enter an uppercase ISO 4217 currency code");
  }
  return value;
}

function optionalText<Field extends "institutionLabel" | "maskedIdentifier">(
  field: Field,
  value: string | undefined,
  maximum: number,
): Partial<Record<Field, string>> {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new AccountValidationError(
      field,
      `${field === "maskedIdentifier" ? "Masked identifier" : "Institution label"} must be ${maximum} characters or fewer`,
    );
  }
  if (field === "maskedIdentifier" && !/^[\p{L}\p{N}*•#() .-]+$/u.test(normalized)) {
    throw new AccountValidationError(field, "Masked identifier contains unsupported characters");
  }
  if (field === "maskedIdentifier" && !/[*•#]/u.test(normalized)) {
    throw new AccountValidationError(
      field,
      "Masked identifier must hide digits with symbols such as •••• 1234",
    );
  }
  if (field === "maskedIdentifier" && (normalized.match(/\p{N}/gu)?.length ?? 0) > 6) {
    throw new AccountValidationError(
      field,
      "Masked identifier may include at most six visible digits",
    );
  }
  return { [field]: normalized } as Partial<Record<Field, string>>;
}
