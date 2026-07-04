import { Injectable, NotFoundException } from '@nestjs/common';
import { EMAIL_TEMPLATE_REGISTRY } from '../templates/registry';

export type { RenderedEmailTemplate } from '../templates/types';

import type { RenderedEmailTemplate } from '../templates/types';

@Injectable()
export class EmailTemplateService {
  render(templateKey: string, variables: Record<string, unknown>): RenderedEmailTemplate {
    const renderer = EMAIL_TEMPLATE_REGISTRY[templateKey];
    if (!renderer) {
      throw new NotFoundException(`Template '${templateKey}' not found`);
    }
    return renderer(variables);
  }

  hasTemplate(templateKey: string): boolean {
    return templateKey in EMAIL_TEMPLATE_REGISTRY;
  }
}
