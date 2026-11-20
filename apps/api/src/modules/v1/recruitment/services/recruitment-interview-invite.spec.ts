import { buildInterviewEmail, buildInterviewIcs } from './recruitment-interview-invite';

const base = {
  interviewId: 'i1',
  candidateFirstName: 'Ada <b>',
  jobTitle: 'Engineer',
  companyName: 'Acme, Inc',
  start: new Date('2027-01-10T09:00:00Z'),
  durationMinutes: 45,
  type: 'VIDEO',
  location: 'Room; 1',
};

describe('interview invite', () => {
  it('builds an ICS request with escaped text and the right end time', () => {
    const ics = buildInterviewIcs({ ...base, kind: 'scheduled' });
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('DTSTART:20270110T090000Z');
    expect(ics).toContain('DTEND:20270110T094500Z');
    expect(ics).toContain('LOCATION:Room\; 1');
    expect(ics).toContain('Acme\\, Inc');
  });

  it('marks cancellations and escapes candidate-controlled html', () => {
    expect(buildInterviewIcs({ ...base, kind: 'cancelled' })).toContain('METHOD:CANCEL');
    const email = buildInterviewEmail({ ...base, kind: 'rescheduled' });
    expect(email.subject).toBe('Interview time changed: Engineer');
    expect(email.html).toContain('Ada &lt;b&gt;');
    expect(email.html).not.toContain('<b>');
  });
});
