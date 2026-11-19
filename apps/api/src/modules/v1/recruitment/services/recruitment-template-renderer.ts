export const RECRUITMENT_TEMPLATE_VARIABLES = [
  'candidate.firstName',
  'candidate.lastName',
  'candidate.fullName',
  'job.title',
  'company.name',
  'stage.name',
  'sender.name',
] as const;

export type RecruitmentTemplateContext = Partial<
  Record<(typeof RECRUITMENT_TEMPLATE_VARIABLES)[number], string>
>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g;
const KNOWN = new Set<string>(RECRUITMENT_TEMPLATE_VARIABLES);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function findUnknownVariables(source: string): string[] {
  const unknown = new Set<string>();
  for (const match of source.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN.has(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}

/** Replaces `{{variable}}` tokens; values are HTML-escaped when rendering a body, never trusted. */
export function renderRecruitmentTemplate(
  source: string,
  context: RecruitmentTemplateContext,
  options: { html: boolean },
): string {
  return source.replace(VARIABLE_PATTERN, (_token, key: string) => {
    const value = KNOWN.has(key) ? (context[key as keyof RecruitmentTemplateContext] ?? '') : '';
    return options.html ? escapeHtml(value) : value;
  });
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
