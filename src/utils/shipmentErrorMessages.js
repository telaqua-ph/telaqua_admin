/**
 * Maps Hostinger/Delhivery shipment error payloads to admin-friendly copy.
 * Never exposes tokens or secrets.
 */

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._\-]+/gi,
  /authorization[:\s]+[^\s,]+/gi,
  /delhivery[_-]?api[_-]?token[=:\s]+[^\s,"']+/gi,
  /api[_-]?token[=:\s]+[^\s,"']+/gi,
  /token[=:\s]+[a-z0-9._\-]{20,}/gi,
];

export function sanitizeTechnicalMessage(message) {
  let text = String(message || '');
  SECRET_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern, '[redacted]');
  });
  return text.trim();
}

export function extractBackendMessage(errorOrData) {
  if (!errorOrData) return '';
  if (typeof errorOrData === 'string') return errorOrData;

  const data = errorOrData.data || errorOrData;
  return (
    data?.message ||
    data?.error ||
    (typeof data?.errors === 'string' ? data.errors : '') ||
    errorOrData.message ||
    ''
  );
}

/**
 * @returns {{ title: string, explanation: string, code: string }}
 */
export function interpretShipmentError(rawMessage, status) {
  const text = String(rawMessage || '').toLowerCase();
  const title = 'Shipment Creation Failed';

  if (
    text.includes('insufficient balance') ||
    text.includes('prepaid client manifest charge') ||
    text.includes('manifest charge api failed due to insufficient')
  ) {
    return {
      title,
      code: 'insufficient_balance',
      explanation:
        'Delhivery account has insufficient balance to create this shipment. Please check the Delhivery account balance and try again.',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    text.includes('unauthor') ||
    text.includes('authentication') ||
    text.includes('invalid token') ||
    text.includes('credential')
  ) {
    return {
      title,
      code: 'auth',
      explanation:
        'Delhivery authentication failed. Please check the Delhivery API credentials.',
    };
  }

  if (
    status === 503 ||
    status === 502 ||
    text.includes('temporarily unavailable') ||
    text.includes('service unavailable') ||
    text.includes('timeout') ||
    text.includes('timed out')
  ) {
    return {
      title,
      code: 'unavailable',
      explanation:
        'Delhivery service is temporarily unavailable. Please try again later.',
    };
  }

  if (
    status === 400 ||
    status === 422 ||
    text.includes('invalid') ||
    text.includes('validation') ||
    text.includes('pincode') ||
    text.includes('pin code') ||
    text.includes('rejected') ||
    text.includes('address') ||
    text.includes('weight')
  ) {
    return {
      title,
      code: 'validation',
      explanation:
        'Delhivery rejected the shipment details. Please check the customer, address, PIN code, weight, and shipment details.',
    };
  }

  if (rawMessage && String(rawMessage).trim()) {
    // Non-matching but useful backend text — keep short friendly wrapper
    return {
      title,
      code: 'backend',
      explanation:
        'Shipment creation failed. Please check the shipment details and try again.',
    };
  }

  return {
    title,
    code: 'unknown',
    explanation:
      'Shipment creation failed. Please check the shipment details and try again.',
  };
}

export function mentionsPartialSave(rawMessage) {
  return String(rawMessage || '')
    .toLowerCase()
    .includes('partially saved');
}
