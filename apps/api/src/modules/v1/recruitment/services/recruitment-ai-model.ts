import type { Agent } from '@mastra/core/agent';

export type AiProvider = 'anthropic' | 'deepseek';

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-5-5',
  deepseek: 'deepseek-chat',
};

type Env = Record<string, string | undefined>;

export type AiModelConfig = { provider: AiProvider; apiKey: string; model: string };

/** Picks the configured provider; an explicit RECRUITMENT_AI_PROVIDER wins, otherwise the first key found. */
export function resolveAiModelConfig(env: Env = process.env): AiModelConfig | null {
  const keys: Record<AiProvider, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY?.trim() || undefined,
    deepseek: env.DEEPSEEK_API_KEY?.trim() || undefined,
  };
  const requested = env.RECRUITMENT_AI_PROVIDER?.trim().toLowerCase();
  const provider: AiProvider | undefined =
    requested === 'anthropic' || requested === 'deepseek'
      ? requested
      : (['anthropic', 'deepseek'] as const).find((name) => keys[name]);
  if (!provider || !keys[provider]) return null;
  return {
    provider,
    apiKey: keys[provider] as string,
    model: env.RECRUITMENT_AI_MODEL?.trim() || DEFAULT_MODELS[provider],
  };
}

type AgentModel = ConstructorParameters<typeof Agent>[0]['model'];

/** Providers load on first use: the SDKs add seconds to API boot and most requests never need them. */
export async function createAiModel(config: AiModelConfig): Promise<AgentModel> {
  if (config.provider === 'deepseek') {
    const { createDeepSeek } = await import('@ai-sdk/deepseek');
    return createDeepSeek({ apiKey: config.apiKey })(config.model);
  }
  const { createAnthropic } = await import('@ai-sdk/anthropic');
  return createAnthropic({ apiKey: config.apiKey })(config.model);
}
