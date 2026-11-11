import "server-only";
import { brandNameForProduct } from "@/lib/brand";

/**
 * Minimal, inline-styled HTML email fragments — kept deliberately simple
 * (a single centered button, no external assets/fonts) for broad email
 * client compatibility rather than a full design system.
 */

function buttonHtml(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">` +
    `<tr><td style="border-radius:8px;background-color:#3333cc;">` +
    `<a href="${href}" target="_blank" rel="noreferrer" ` +
    `style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;` +
    `font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>` +
    `</td></tr></table>`
  );
}

function wrapper(bodyHtml: string, brand = "Margav Heating"): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#000000;max-width:480px;">` +
    `<p style="font-size:18px;font-weight:bold;margin:0 0 4px;">${brand}</p>` +
    bodyHtml +
    `<p style="font-size:12px;color:#a3a3a3;margin-top:32px;">${brand}</p>` +
    `</div>`
  );
}

export function signQuoteEmailHtml(params: {
  customerName: string;
  reference: string;
  totalPriceLabel: string;
  productTypeLabel: string;
  signLink: string;
}): string {
  return wrapper(
    `<p>Hi ${params.customerName},</p>` +
      `<p>Your ${params.productTypeLabel} quote (${params.reference}, ${params.totalPriceLabel}) is ready to review and sign.</p>` +
      buttonHtml(params.signLink, "Review & sign quote") +
      `<p style="font-size:13px;color:#737373;">Or copy this link: <a href="${params.signLink}">${params.signLink}</a></p>` +
      `<p style="font-size:13px;color:#737373;">This link is unique to you — please don&rsquo;t share it.</p>`,
    brandNameForProduct(params.productTypeLabel),
  );
}

export function signAgreementEmailHtml(params: {
  customerName: string;
  reference: string;
  signLink: string;
  /** Defaults to the boiler agreement's name. */
  documentName?: string;
  /** "Solar" picks the MarGav Solar trading name; omitted means Margav Heating. */
  productTypeLabel?: string;
}): string {
  return wrapper(
    `<p>Hi ${params.customerName},</p>` +
      `<p>Please review and sign your ${params.documentName ?? "Boiler Installation Agreement"} for quote ${params.reference}.</p>` +
      buttonHtml(params.signLink, "Review & sign agreement") +
      `<p style="font-size:13px;color:#737373;">Or copy this link: <a href="${params.signLink}">${params.signLink}</a></p>` +
      `<p style="font-size:13px;color:#737373;">This link is unique to you — please don&rsquo;t share it.</p>`,
    brandNameForProduct(params.productTypeLabel),
  );
}

export function signWaiverEmailHtml(params: {
  customerName: string;
  reference: string;
  signLink: string;
  /** "Solar" picks the MarGav Solar trading name; omitted means Margav Heating. */
  productTypeLabel?: string;
}): string {
  return wrapper(
    `<p>Hi ${params.customerName},</p>` +
      `<p>Please review and sign your Cooling-Off Waiver for quote ${params.reference}.</p>` +
      buttonHtml(params.signLink, "Review & sign waiver") +
      `<p style="font-size:13px;color:#737373;">Or copy this link: <a href="${params.signLink}">${params.signLink}</a></p>` +
      `<p style="font-size:13px;color:#737373;">This link is unique to you — please don&rsquo;t share it.</p>`,
    brandNameForProduct(params.productTypeLabel),
  );
}

export function signedConfirmationEmailHtml(params: {
  customerName: string;
  reference: string;
  /** e.g. "quote" or "installation agreement" — defaults to "quote" for the original call sites. */
  documentLabel?: string;
  /** "Solar PV" / "Boiler" — picks the trading name; omitted means Margav Heating. */
  productTypeLabel?: string;
}): string {
  const documentLabel = params.documentLabel ?? "quote";
  return wrapper(
    `<p>Hi ${params.customerName},</p>` +
      `<p>Thanks for signing ${documentLabel} ${params.reference}. Your signed copy is attached to this email for your records.</p>` +
      `<p>We&rsquo;ll be in touch about next steps shortly.</p>`,
    brandNameForProduct(params.productTypeLabel),
  );
}
