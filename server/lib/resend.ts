import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn('Resend API key not configured. Email sending will fail.');
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, email not sent:', options.subject);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'VisioSport <notifications@visiosport.com>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
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
        This is an automated message from VisioSport. Please do not reply to this email.
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
        This is an automated message from VisioSport.
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
        This is an automated message from VisioSport.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `Payment Confirmed - $${amount.toFixed(2)}`,
    html,
  });
}
