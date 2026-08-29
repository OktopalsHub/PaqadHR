import { AGENT_ACTION_REQUIRED_SCOPES, AGENT_ACTIONS, HIGH_RISK_AGENT_ACTIONS } from '@paqadhr/contracts';

describe('agent action contracts', () => {
  it('maps every action to required scopes', () => {
    for (const action of AGENT_ACTIONS) {
      expect(AGENT_ACTION_REQUIRED_SCOPES[action]).toBeDefined();
      expect(AGENT_ACTION_REQUIRED_SCOPES[action].length).toBeGreaterThan(0);
    }
  });

  it('queues leave.reject as high risk', () => {
    expect(HIGH_RISK_AGENT_ACTIONS).toContain('leave.reject');
  });
});
