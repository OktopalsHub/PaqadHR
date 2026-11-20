export const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: 'Application received',
    subject: 'We received your application for {{job.title}}',
    bodyHtml:
      '<p>Hi {{candidate.firstName}},</p><p>Thank you for applying for {{job.title}} at {{company.name}}. Our team will review your application and get back to you soon.</p><p>{{sender.name}}</p>',
  },
  {
    name: 'Interview invitation',
    subject: 'Interview with {{company.name}} for {{job.title}}',
    bodyHtml:
      '<p>Hi {{candidate.firstName}},</p><p>We would like to invite you to interview for {{job.title}}. We will follow up shortly with the available times.</p><p>{{sender.name}}</p>',
  },
  {
    name: 'Offer extended',
    subject: 'Your offer from {{company.name}}',
    bodyHtml:
      '<p>Hi {{candidate.firstName}},</p><p>We are delighted to extend you an offer for {{job.title}}. We will send the details separately.</p><p>{{sender.name}}</p>',
  },
  {
    name: 'Application update (not moving forward)',
    subject: 'Your application for {{job.title}}',
    bodyHtml:
      '<p>Hi {{candidate.firstName}},</p><p>Thank you for your interest in {{company.name}}. After careful consideration we will not be moving forward with your application for {{job.title}}. We appreciate your time and wish you every success.</p><p>{{sender.name}}</p>',
  },
  {
    name: 'Application accepted',
    subject: 'Welcome to {{company.name}}',
    bodyHtml:
      '<p>Hi {{candidate.firstName}},</p><p>Congratulations! We are pleased to let you know your application for {{job.title}} has been accepted. We will be in touch with the next steps.</p><p>{{sender.name}}</p>',
  },
] as const;
