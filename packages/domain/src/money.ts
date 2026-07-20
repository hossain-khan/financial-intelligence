import Decimal from "decimal.js";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

export class CurrencyMismatchError extends Error {
  public constructor(left: string, right: string) {
    super(`Cannot combine ${left} and ${right}`);
    this.name = "CurrencyMismatchError";
  }
}

export class Money {
  readonly #value: Decimal;

  private constructor(
    amount: string,
    public readonly currency: string,
  ) {
    this.#value = new Decimal(amount);
  }

  public static from(amount: string, currency: string): Money {
    if (!DECIMAL_PATTERN.test(amount)) {
      throw new TypeError(`Invalid decimal amount: ${amount}`);
    }

    if (!CURRENCY_PATTERN.test(currency)) {
      throw new TypeError(`Invalid ISO 4217 currency code: ${currency}`);
    }

    return new Money(amount, currency);
  }

  public static zero(currency: string): Money {
    return Money.from("0", currency);
  }

  public add(other: Money): Money {
    this.#assertSameCurrency(other);
    return Money.from(this.#value.plus(other.#value).toFixed(), this.currency);
  }

  public subtract(other: Money): Money {
    this.#assertSameCurrency(other);
    return Money.from(this.#value.minus(other.#value).toFixed(), this.currency);
  }

  public negate(): Money {
    const amount = this.#value.isZero() ? "0" : this.#value.negated().toFixed();
    return Money.from(amount, this.currency);
  }

  public abs(): Money {
    return Money.from(this.#value.abs().toFixed(), this.currency);
  }

  public equals(other: Money): boolean {
    if (this.currency !== other.currency) return false;
    return this.#value.equals(other.#value);
  }

  public compareTo(other: Money): number {
    this.#assertSameCurrency(other);
    return this.#value.comparedTo(other.#value);
  }

  public isGreaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  public isLessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  public isGreaterThanOrEqual(other: Money): boolean {
    return this.compareTo(other) >= 0;
  }

  public isLessThanOrEqual(other: Money): boolean {
    return this.compareTo(other) <= 0;
  }

  public isInflow(): boolean {
    return this.#value.isPositive();
  }

  public isOutflow(): boolean {
    return this.#value.isNegative();
  }

  public isZero(): boolean {
    return this.#value.isZero();
  }

  public ratioTo(other: Money, decimalPlaces = 4): string {
    this.#assertSameCurrency(other);
    if (other.#value.isZero()) throw new RangeError("Cannot calculate a ratio with zero");
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 20) {
      throw new RangeError("Ratio decimal places must be an integer between 0 and 20");
    }
    return this.#value.dividedBy(other.#value).toFixed(decimalPlaces);
  }

  public percentageOf(other: Money, decimalPlaces = 1): string {
    this.#assertSameCurrency(other);
    if (other.#value.isZero()) throw new RangeError("Cannot calculate a percentage with zero");
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 20) {
      throw new RangeError("Percentage decimal places must be an integer between 0 and 20");
    }
    return this.#value.dividedBy(other.#value).times(100).toFixed(decimalPlaces);
  }

  public toJSON(): { amount: string; currency: string } {
    return { amount: this.#value.toFixed(), currency: this.currency };
  }

  public toString(): string {
    return `${this.currency} ${this.#value.toFixed()}`;
  }

  #assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
