/**
 * PII (Personally Identifiable Information) Masking Utility
 * Redacts sensitive legal-tech data before sending to AI or logs.
 */

const CITIZEN_ID_REGEX = /\b\d{1}-?\d{4}-?\d{5}-?\d{2}-?\d{1}\b/g;
const THAI_PHONE_REGEX = /(\+66|0)[-.\s]?\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Mask sensitive data in a string.
 */
export function maskPII(text: string): string {
  if (!text) return text;

  let masked = text;

  // 1. Mask Citizen IDs (Replace with [ID])
  masked = masked.replace(CITIZEN_ID_REGEX, "[CITIZEN_ID]");

  // 2. Mask Phone Numbers
  masked = masked.replace(THAI_PHONE_REGEX, "[PHONE]");

  // 3. Mask Emails
  masked = masked.replace(EMAIL_REGEX, "[EMAIL]");

  // 4. Heuristic for Thai Names (Optional: Look for นาย/นาง/นางสาว)
  masked = masked.replace(/(นาย|นาง|นางสาว|คุณ)\s?([ก-๙]+)\s+([ก-๙]+)/g, "$1 [NAME] [SURNAME]");

  return masked;
}

/**
 * Utility to sanitize form data before logging.
 */
export function sanitizeLogData(data: any): any {
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '********';
    }
  }
  
  return sanitized;
}
