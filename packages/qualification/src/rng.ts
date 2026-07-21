/**
 * Deterministic pseudo-random generator for reproducible synthetic workloads. A benchmark must be
 * byte-for-byte reproducible from its seed so that a change in the *data* can never be mistaken for
 * a change in *performance*; this is a small linear-congruential generator (the same family already
 * used inline in the CSV parser tests) rather than `Math.random`, which is non-deterministic and
 * unavailable in some sandboxes.
 */
export class SeededRng {
  private state: number;

  public constructor(seed: number) {
    // Fold the seed into the 32-bit state; avoid a zero state which would stick the generator.
    this.state = seed >>> 0 === 0 ? 0x9e3779b9 : seed >>> 0;
  }

  /** Next 32-bit unsigned integer. */
  public nextUint32(): number {
    // Numerical Recipes LCG constants; `Math.imul` keeps the multiply in 32-bit space.
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    return this.state;
  }

  /** Float in [0, 1). */
  public nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  /** Integer in [min, max] inclusive. */
  public nextInt(min: number, max: number): number {
    if (max < min) throw new Error("nextInt requires max >= min");
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /** Pick one element deterministically. */
  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error("pick requires a non-empty array");
    const chosen = values[this.nextInt(0, values.length - 1)];
    if (chosen === undefined) throw new Error("pick produced no value");
    return chosen;
  }
}

/**
 * Emit RFC 9562 UUIDs whose version/variant nibbles satisfy the domain ID parsers (version `[1-8]`,
 * variant `[89ab]`), derived deterministically from a seeded generator. Using seeded UUIDs — rather
 * than `crypto.randomUUID()` — keeps a generated workspace's IDs stable across runs so its digest is
 * reproducible.
 */
export class SeededUuidFactory {
  public constructor(private readonly rng: SeededRng) {}

  public next(): string {
    const hex: string[] = [];
    for (let index = 0; index < 32; index += 1) {
      hex.push(this.rng.nextInt(0, 15).toString(16));
    }
    // Force version 4 and a variant of 8 so the value is a valid, parser-accepted UUID.
    hex[12] = "4";
    hex[16] = "8";
    const chars = hex.join("");
    return `${chars.slice(0, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}-${chars.slice(16, 20)}-${chars.slice(20, 32)}`;
  }
}
