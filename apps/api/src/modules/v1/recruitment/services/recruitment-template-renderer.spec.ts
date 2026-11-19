import {
  findUnknownVariables,
  htmlToText,
  renderRecruitmentTemplate,
} from './recruitment-template-renderer';

describe('recruitment template renderer', () => {
  it('fills known variables and blanks unknown ones', () => {
    const out = renderRecruitmentTemplate(
      'Hi {{candidate.firstName}}, {{job.title}} {{secret.value}}!',
      { 'candidate.firstName': 'Ada', 'job.title': 'Engineer' },
      { html: false },
    );
    expect(out).toBe('Hi Ada, Engineer !');
  });

  it('escapes variable values in html bodies', () => {
    const out = renderRecruitmentTemplate(
      '<p>{{candidate.firstName}}</p>',
      { 'candidate.firstName': '<script>alert(1)</script>' },
      { html: true },
    );
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('reports unknown variables', () => {
    expect(findUnknownVariables('{{candidate.firstName}} {{foo.bar}}')).toEqual(['foo.bar']);
  });

  it('derives a plain-text body', () => {
    expect(htmlToText('<p>Hello &amp; welcome</p><p>Bye</p>')).toBe('Hello & welcome\n\nBye');
  });
});
