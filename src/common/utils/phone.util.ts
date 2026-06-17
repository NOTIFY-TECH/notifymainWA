/**
 * Phone number normalisation + validation for NotifyTechAI.
 *
 * Rule: all phone numbers stored in the DB and sent to the engine must be
 * in bare E.164 format WITHOUT the leading +, e.g. 919876543210.
 *
 * Valid inputs accepted and normalised:
 *   919876543210      → 919876543210  (already correct)
 *   +919876543210     → 919876543210  (strip +)
 *   9876543210        → 919876543210  (bare 10-digit Indian, prepend 91)
 *   +1 650-555-0123   → 16505550123   (international with formatting)
 *   001 650 555 0123  → 16505550123   (00-prefix international)
 *
 * Rejected:
 *   12345             → too short after normalisation
 *   abcdefghij        → non-numeric
 *   0876543210        → 10-digit starting with 0 (not a valid Indian mobile)
 */

// Minimum/maximum digit counts for a valid E.164 number (excl. leading +).
// ITU-T E.164 allows up to 15 digits; shortest valid numbers are ~7 digits
// (some small island nations) but we floor at 10 to avoid garbage data.
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

export interface NormaliseResult {
  normalised: string; // bare digits, ready to store/send
  valid: boolean;
  reason?: string; // present when valid === false
}

/**
 * Normalise and validate a raw phone number string.
 * Returns { valid: true, normalised } or { valid: false, reason }.
 */
export function normalisePhone(raw: string): NormaliseResult {
  if (!raw || typeof raw !== 'string') {
    return { normalised: '', valid: false, reason: 'Phone number is required' };
  }

  let digits = raw.trim();

  // Strip leading 00 international prefix (e.g. 0091...) → treat as +91...
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Strip leading +
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  // Strip all non-digit characters (spaces, dashes, parentheses, dots)
  digits = digits.replace(/\D/g, '');

  if (digits.length === 0) {
    return { normalised: '', valid: false, reason: 'Phone number contains no digits' };
  }

  // Bare 10-digit number: assume Indian mobile, prepend 91.
  // Reject if it starts with 0 (Indian mobiles start with 6–9).
  if (digits.length === 10) {
    if (digits.startsWith('0')) {
      return {
        normalised: '',
        valid: false,
        reason: `10-digit number starting with 0 is not a valid Indian mobile number`,
      };
    }
    digits = '91' + digits;
  }

  if (digits.length < MIN_DIGITS) {
    return {
      normalised: '',
      valid: false,
      reason: `Phone number too short (${digits.length} digits after normalisation, minimum ${MIN_DIGITS})`,
    };
  }

  if (digits.length > MAX_DIGITS) {
    return {
      normalised: '',
      valid: false,
      reason: `Phone number too long (${digits.length} digits after normalisation, maximum ${MAX_DIGITS})`,
    };
  }

  return { normalised: digits, valid: true };
}

/**
 * Normalise and throw BadRequestException if invalid.
 * Convenience wrapper for use in service methods and CSV import loops.
 */
export function normalisePhoneOrThrow(raw: string, label = 'Phone number'): string {
  const result = normalisePhone(raw);
  if (!result.valid) {
    // Importing BadRequestException inline to keep this utility free of
    // NestJS-specific imports at the top level — only used server-side but
    // avoids a circular dependency if this file is ever shared.
    const { BadRequestException } = require('@nestjs/common');
    throw new BadRequestException(`${label}: ${result.reason}`);
  }
  return result.normalised;
}
