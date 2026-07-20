import { escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import {
  emailFriendsSignOff,
  emailHeading,
  emailParagraph,
  emailPostscript,
  emailSection,
  emailSentWithCare,
  emailSubheading,
  greetingFirstName,
  resolveFirstName,
} from './shared';
import type { RenderedEmailTemplate } from './types';

export interface WelcomeEmailVariables {
  firstName?: string;
  email?: string;
  tenantName?: string;
  setupUrl: string;
  workspaceUrl?: string;
  trialUrl?: string;
  docsUrl?: string;
}

export function renderWelcomeEmail(vars: WelcomeEmailVariables): RenderedEmailTemplate {
  const firstName = greetingFirstName(vars.firstName, vars.email);
  const plainName = resolveFirstName(vars.firstName, vars.email);
  const tenantName = vars.tenantName?.trim();
  const safeTenant = tenantName ? escapeHtml(tenantName) : undefined;

  const setupUrl = vars.setupUrl.trim();
  const workspaceUrl = vars.workspaceUrl?.trim() || setupUrl;
  const trialUrl = vars.trialUrl?.trim() || setupUrl;
  const docsUrl = vars.docsUrl?.trim() || setupUrl;

  const headline = safeTenant ? `Welcome to ${safeTenant}!` : `Welcome ${firstName}!`;
  const subject = safeTenant
    ? `Welcome to ${tenantName} on PaqadHR`
    : `Welcome to PaqadHR, ${plainName}!`;
  const preheader = safeTenant
    ? `Your ${tenantName} workspace is ready — here's where to start`
    : 'HR, payroll, and crypto payouts in one workspace';

  const intro = safeTenant
    ? emailParagraph(
        `You're building something worth showing up for every day — and <strong>${safeTenant}</strong> is ready on PaqadHR.`,
      )
    : emailParagraph("You're building something worth showing up for every day.");

  const pitch = emailParagraph(
    'We built PaqadHR because HR, payroll, leave, recruitment, and getting your team paid — including with crypto — should not mean stitching together tools that were never meant to work as one.',
  );

  const setupSection = safeTenant
    ? emailSection(
        'Open your workspace',
        'Your team directory, settings, and HR tools are ready. Invite colleagues and explore what you can run from one place.',
        { href: workspaceUrl, label: 'Open your workspace' },
      )
    : emailSection(
        'Set up your workspace',
        'Create your workspace, invite your team, and explore leave, attendance, recruitment, and payroll before you go live.',
        { href: setupUrl, label: 'Set up your workspace' },
      );

  const trialSection = emailSection(
    'Start your free trial',
    "When you're ready, pick a plan and start a 14-day trial. Explore everything PaqadHR offers before you commit.",
    { href: trialUrl, label: 'Start 14-day free trial' },
  );

  const docsSection = emailSection(
    'Explore the product',
    'Walk through your dashboard, settings, and team tools. Everything you need to get started is already in your account.',
    { href: docsUrl, label: safeTenant ? 'Go to dashboard' : 'Go to onboarding' },
  );

  const bodyHtml = [
    emailHeading(headline),
    intro,
    pitch,
    emailSubheading('Here are the best places to start.'),
    setupSection,
    trialSection,
    docsSection,
    emailFriendsSignOff(),
    emailPostscript(
      "We'll check in over the next few days to see how things are going. We're looking forward to your feedback!",
    ),
    emailSentWithCare(),
  ].join('');

  const textLines = [
    headline,
    '',
    safeTenant
      ? `Your workspace ${tenantName} is ready on PaqadHR.`
      : "You're building something worth showing up for every day.",
    '',
    'We built PaqadHR because HR, payroll, leave, recruitment, and crypto payouts should work together — not as separate tools.',
    '',
    'Here are the best places to start:',
    '',
    safeTenant ? `Open your workspace: ${workspaceUrl}` : `Set up your workspace: ${setupUrl}`,
    `Start your free trial: ${trialUrl}`,
    `Explore: ${docsUrl}`,
    '',
    'Thanks,',
    'Your friends at PaqadHR',
    '',
    "P.S. We'll check in over the next few days to see how things are going.",
  ];

  return {
    subject,
    html: renderEmailLayout({ preheader, content: bodyHtml }),
    text: textLines.join('\n'),
  };
}
