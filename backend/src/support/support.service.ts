import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

const SUBJECT_LABELS: Record<string, string> = {
  bug: 'Bug / App not working',
  session: 'WhatsApp session issue',
  campaign: 'Campaign not sending',
  inbox: 'Contacts / Inbox issue',
  billing: 'Billing / Account',
  other: 'Other',
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async submitTicket(
    tenantId: string,
    userId: string,
    userEmail: string,
    dto: CreateSupportTicketDto,
  ) {
    const subjectLabel = SUBJECT_LABELS[dto.subject] ?? dto.subject;
    const submittedAt = new Date().toISOString();

    try {
      await this.resend.emails.send({
        from:
          this.configService.get('RESEND_FROM_EMAIL') ??
          'noreply@notifytechai.com',
        to: 'support@notifytechai.com',
        replyTo: userEmail,
        subject: `[Support] ${subjectLabel} — ${userEmail}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
            <h2 style="margin: 0 0 4px; font-size: 20px;">New Support Request</h2>
            <p style="margin: 0 0 24px; color: #888; font-size: 13px;">${submittedAt}</p>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; color: #555; width: 120px;">From</td>
                <td style="padding: 10px 0; font-weight: 600;">${userEmail}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; color: #555;">User ID</td>
                <td style="padding: 10px 0; font-family: monospace; font-size: 13px;">${userId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; color: #555;">Tenant ID</td>
                <td style="padding: 10px 0; font-family: monospace; font-size: 13px;">${tenantId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #555;">Category</td>
                <td style="padding: 10px 0; font-weight: 600;">${subjectLabel}</td>
              </tr>
            </table>

            <div style="background: #f5f5f5; border-radius: 8px; padding: 16px 20px; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${dto.message}</div>

            <p style="margin: 24px 0 0; color: #aaa; font-size: 12px;">
              Reply to this email to respond directly to the user.
            </p>
          </div>
        `,
      });

      this.logger.log(
        `Support ticket submitted by ${userEmail} (tenant: ${tenantId}) — category: ${subjectLabel}`,
      );
    } catch (err) {
      this.logger.error(`Failed to send support email from ${userEmail}:`, err);
      throw err;
    }

    return { data: { message: 'Support request submitted successfully.' } };
  }
}
