import { Injectable } from '@nestjs/common';
import type { AgentActionName } from '@paqadhr/contracts';
import type { AgentActionHandler } from './agent-action.types';

/**
 * Maps action names to handler functions.
 * Adding an action = write a handler + register it (see register-agent-action-handlers.ts).
 */
@Injectable()
export class AgentActionRegistry {
  private readonly handlers = new Map<AgentActionName, AgentActionHandler>();

  register(action: AgentActionName, handler: AgentActionHandler): void {
    if (this.handlers.has(action)) {
      throw new Error(`Handler already registered for action: ${action}`);
    }
    this.handlers.set(action, handler);
  }

  get(action: AgentActionName): AgentActionHandler | undefined {
    return this.handlers.get(action);
  }

  list(): AgentActionName[] {
    return Array.from(this.handlers.keys());
  }
}
