import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = 'VisioSquad <no-reply@visiosquad.com>';
const REPLY_TO = 'visionairecommerce@gmail.com';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'visionairecommerce@gmail.com';

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('Resend email client initialized successfully');
} else {
  console.warn('RESEND_API_KEY not configured. Email sending will be disabled.');
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function isResendConfigured(): boolean {
  return resend !== null;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!resend) {
    console.warn('[Resend] Not configured, email not sent:', { subject: options.subject, to: options.to });
    return { success: false, error: 'Email service not configured' };
  }

  try {
    console.log('[Resend] Sending email:', { subject: options.subject, to: options.to });
    
    const { data, error } = await resend.emails.send({
      from: options.from || DEFAULT_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || REPLY_TO,
    });

    if (error) {
      console.error('[Resend] API error:', { error, subject: options.subject });
      return { success: false, error: error.message };
    }

    console.log('[Resend] Email sent successfully:', { id: data?.id, subject: options.subject });
    return { success: true, id: data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Resend] Exception while sending email:', { error: errorMessage, subject: options.subject });
    return { success: false, error: errorMessage };
  }
}

export async function sendTestEmail(): Promise<EmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">VisioSquad Email Test</h2>
      <p>This is a test email to verify that the Resend integration is working correctly.</p>
      <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>Status:</strong> Email service is operational</p>
        <p style="margin: 8px 0 0;"><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p style="margin: 8px 0 0;"><strong>From:</strong> ${DEFAULT_FROM}</p>
        <p style="margin: 8px 0 0;"><strong>Reply-To:</strong> ${REPLY_TO}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated test message from VisioSquad.
      </p>
    </div>
  `;

  return sendEmail({
    to: OWNER_EMAIL,
    subject: 'VisioSquad Email Test - Configuration Verified',
    html,
  });
}

export async function sendSessionCancellationEmail(
  parentEmails: string[],
  sessionTitle: string,
  cancellationReason: string,
  sessionDate: string
): Promise<EmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Session Cancelled</h2>
      <p>We regret to inform you that the following session has been cancelled:</p>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Session:</strong> ${sessionTitle}</p>
        <p style="margin: 8px 0 0;"><strong>Date:</strong> ${sessionDate}</p>
      </div>
      <p><strong>Reason:</strong> ${cancellationReason}</p>
      <p>We apologize for any inconvenience this may cause.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated message from VisioSquad. Please do not reply to this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: parentEmails,
    subject: `Session Cancelled: ${sessionTitle}`,
    html,
  });
}

export async function sendContractSignedNotification(
  adminEmails: string[],
  coachEmails: string[],
  athleteName: string,
  programName: string
): Promise<EmailResult> {
  const allRecipients = [...adminEmails, ...coachEmails];

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">New Contract Signed</h2>
      <p>A new contract has been signed!</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #16a34a;">
        <p style="margin: 0;"><strong>Athlete:</strong> ${athleteName}</p>
        <p style="margin: 8px 0 0;"><strong>Program:</strong> ${programName}</p>
        <p style="margin: 8px 0 0;"><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated message from VisioSquad.
      </p>
    </div>
  `;

  return sendEmail({
    to: allRecipients,
    subject: `New Contract Signed: ${athleteName} - ${programName}`,
    html,
  });
}

export async function sendPaymentConfirmation(
  email: string,
  athleteName: string,
  amount: number,
  description: string
): Promise<EmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Payment Confirmed</h2>
      <p>Thank you for your payment!</p>
      <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>Athlete:</strong> ${athleteName}</p>
        <p style="margin: 8px 0 0;"><strong>Description:</strong> ${description}</p>
        <p style="margin: 8px 0 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 8px 0 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated message from VisioSquad.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `Payment Confirmed - $${amount.toFixed(2)}`,
    html,
  });
}

export async function sendDocuSealOnboardingRequest(
  clubName: string,
  directorEmail: string,
  directorName: string | null,
  payload: { program_name?: string; team_name?: string; template_id?: string; contract_name?: string },
  dashboardUrl: string
): Promise<EmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">DocuSeal Onboarding Needed</h2>
      <p>A club director is trying to set up DocuSeal contracts but their club is not yet onboarded.</p>
      
      <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0;"><strong>Club:</strong> ${clubName}</p>
        <p style="margin: 8px 0 0;"><strong>Director:</strong> ${directorName || 'N/A'} (${directorEmail})</p>
        ${payload.contract_name ? `<p style="margin: 8px 0 0;"><strong>Contract Name:</strong> ${payload.contract_name}</p>` : ''}
        ${payload.program_name ? `<p style="margin: 8px 0 0;"><strong>Program:</strong> ${payload.program_name}</p>` : ''}
        ${payload.team_name ? `<p style="margin: 8px 0 0;"><strong>Team:</strong> ${payload.team_name}</p>` : ''}
        ${payload.template_id ? `<p style="margin: 8px 0 0;"><strong>Template ID Attempted:</strong> ${payload.template_id}</p>` : ''}
      </div>

      <h3 style="color: #374151; margin-top: 24px;">Onboarding Checklist:</h3>
      <ol style="color: #4b5563; line-height: 1.8;">
        <li>Go to <a href="https://docuseal.com/console" style="color: #2563eb;">DocuSeal Console</a></li>
        <li>Create a Team with the club name: <strong>${clubName}</strong></li>
        <li>Invite the director (<strong>${directorEmail}</strong>) as Admin</li>
        <li>Director logs in and creates Templates</li>
        <li>Director copies Template IDs into VisioSquad contracts</li>
        <li>Test webhook and signing flow</li>
      </ol>

      <div style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View in Owner Dashboard
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated message from VisioSquad.
      </p>
    </div>
  `;

  return sendEmail({
    to: OWNER_EMAIL,
    subject: `DocuSeal onboarding needed: ${clubName}`,
    html,
  });
}
