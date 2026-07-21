import { validateAiProvider, type AIProviderProfile } from "@financial-intelligence/schemas";

export interface AiProviderConfigRepository {
  findActive(): Promise<AIProviderProfile | undefined>;
  save(profile: AIProviderProfile): Promise<void>;
}

export interface AiProviderConfigDeps {
  readonly repository: AiProviderConfigRepository;
  readonly newId: () => string;
  readonly now: () => string;
}

export class AiProviderConfigValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigValidationError";
  }
}

export function createDefaultNoAiProfile(id: string, now: string): AIProviderProfile {
  return {
    schemaVersion: "1.0.0",
    id,
    name: "No AI",
    kind: "none",
    enabled: false,
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class GetAiProviderConfig {
  public constructor(private readonly deps: AiProviderConfigDeps) {}

  public async execute(): Promise<AIProviderProfile> {
    const existing = await this.deps.repository.findActive();
    if (existing !== undefined) return existing;
    const seeded = createDefaultNoAiProfile(this.deps.newId(), this.deps.now());
    await this.deps.repository.save(seeded);
    return seeded;
  }
}

export class SetAiProviderProfile {
  public constructor(private readonly deps: AiProviderConfigDeps) {}

  public async execute(profile: AIProviderProfile): Promise<void> {
    const result = validateAiProvider(profile);
    if (!result.valid) {
      throw new AiProviderConfigValidationError(
        `Invalid AI provider profile: ${result.errors
          .map((error) => `${error.instancePath} ${error.message}`)
          .join("; ")}`,
      );
    }
    await this.deps.repository.save(profile);
  }
}
