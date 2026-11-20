import { resolveAiModelConfig } from './recruitment-ai-model';

describe('resolveAiModelConfig', () => {
  it('returns null when no key is configured', () => {
    expect(resolveAiModelConfig({})).toBeNull();
  });

  it('prefers Anthropic when both keys exist and no provider is set', () => {
    expect(resolveAiModelConfig({ ANTHROPIC_API_KEY: 'a', DEEPSEEK_API_KEY: 'd' })).toMatchObject({
      provider: 'anthropic',
    });
  });

  it('uses DeepSeek when it is the only key or is selected explicitly', () => {
    expect(resolveAiModelConfig({ DEEPSEEK_API_KEY: 'd' })).toEqual({
      provider: 'deepseek',
      apiKey: 'd',
      model: 'deepseek-chat',
    });
    expect(
      resolveAiModelConfig({
        ANTHROPIC_API_KEY: 'a',
        DEEPSEEK_API_KEY: 'd',
        RECRUITMENT_AI_PROVIDER: 'deepseek',
        RECRUITMENT_AI_MODEL: 'deepseek-reasoner',
      }),
    ).toMatchObject({ provider: 'deepseek', model: 'deepseek-reasoner' });
  });

  it('returns null when the selected provider has no key', () => {
    expect(
      resolveAiModelConfig({ ANTHROPIC_API_KEY: 'a', RECRUITMENT_AI_PROVIDER: 'deepseek' }),
    ).toBeNull();
  });
});
