import { Resend } from 'resend';
import { env } from './env.js';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!resend) {
    console.log(`\n[Email Dev Preview] -> To: ${to} | Subject: ${subject}`);
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log('---');
    return;
  }

  try {
    await resend.emails.send({
      from: env.resendFromEmail,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[Resend Error]', err);
  }
}

export function buildVerificationEmailHtml(name: string, verifyUrl: string, isOfficialStudentEmail: boolean): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="display: inline-block; padding: 6px 12px; background: #eef2ff; color: #4f46e5; font-weight: 700; border-radius: 999px; font-size: 13px;">SwapU</div>
      <h2 style="margin: 16px 0 8px; font-size: 22px;">გამარჯობა, ${name}!</h2>
      <p style="color: #475569; line-height: 1.6;">
        გმადლობთ SwapU-ზე რეგისტრაციისთვის. ${
          isOfficialStudentEmail
            ? 'თქვენი უნივერსიტეტის ელფოსტის დადასტურებისთანავე ავტომატურად მიიღებთ ვერიფიცირებული სტუდენტის სტატუსს.'
            : 'გთხოვთ დაადასტუროთ თქვენი ელფოსტა ანგარიშის გასააქტიურებლად.'
        }
      </p>
      <a href="${verifyUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 10px;">
        ელფოსტის დადასტურება
      </a>
      <p style="color: #94a3b8; font-size: 13px;">თუ ბმული არ მუშაობს, დააკოპირეთ მისამართი: ${verifyUrl}</p>
    </div>
  `;
}

export function buildResetPasswordEmailHtml(name: string, resetUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="display: inline-block; padding: 6px 12px; background: #eef2ff; color: #4f46e5; font-weight: 700; border-radius: 999px; font-size: 13px;">SwapU</div>
      <h2 style="margin: 16px 0 8px; font-size: 22px;">პაროლის აღდგენა</h2>
      <p style="color: #475569; line-height: 1.6;">გამარჯობა, ${name}. პაროლის შესაცვლელად დააჭირეთ ქვემოთ მოცემულ ღილაკს. ბმული მოქმედებს 1 საათის განმავლობაში.</p>
      <a href="${resetUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 10px;">
        ახალი პაროლის დაყენება
      </a>
      <p style="color: #94a3b8; font-size: 13px;">თუ ეს მოთხოვნა თქვენ არ გაგიგზავნიათ, უგულებელყავით წერილი.</p>
    </div>
  `;
}

export function buildMagicLoginEmailHtml(magicUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="display: inline-block; padding: 6px 12px; background: #f3e8ff; color: #6d28d9; font-weight: 700; border-radius: 999px; font-size: 13px;">SwapU</div>
      <h2 style="margin: 16px 0 8px; font-size: 22px;">სისტემაში შესვლის ლინკი</h2>
      <p style="color: #475569; line-height: 1.6;">
        დააჭირე ქვემოთ მოცემულ ღილაკს SwapU-ში შესასვლელად ან რეგისტრაციის დასასრულებლად. ბმული მოქმედებს 30 წუთის განმავლობაში.
      </p>
      <a href="${magicUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #1e2229; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 999px;">
        სისტემაში შესვლა
      </a>
      <p style="color: #94a3b8; font-size: 13px;">თუ ბმული არ მუშაობს: ${magicUrl}</p>
    </div>
  `;
}

export function buildOfferEmailHtml(params: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  ctaLabel: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="display: inline-block; padding: 6px 12px; background: #eef2ff; color: #4f46e5; font-weight: 700; border-radius: 999px; font-size: 13px;">SwapU შეტყობინება</div>
      <h2 style="margin: 16px 0 8px; font-size: 20px;">${params.title}</h2>
      <p style="color: #475569; line-height: 1.6;">გამარჯობა, ${params.recipientName}!</p>
      <p style="color: #334155; line-height: 1.6; background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">${params.message}</p>
      <a href="${params.actionUrl}" style="display: inline-block; margin: 18px 0 6px; padding: 12px 22px; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 10px;">
        ${params.ctaLabel}
      </a>
    </div>
  `;
}
