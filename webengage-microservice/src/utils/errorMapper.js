'use strict';

/**
 * Dynamic WebEngage Error Mapper.
 * Maps SPARC error keywords to official WebEngage status codes + HTTP statuses.
 * Ref: WebEngage RSP Integration Spec v1.0
 */
const WEBENGAGE_ERROR_MAP = [
  // 2022 — Sender/Bot/Assistant ID issues → HTTP 413
  { keywords: ['SENDER', 'BOT', 'ASSISTANT'],          code: 2022, httpStatus: 413, message: 'Sender Id is Invalid' },
  // 1002 — Entity not found → HTTP 401
  { keywords: ['ENTITY', 'NOT FOUND', 'NOT EXIST'],    code: 1002, httpStatus: 401, message: 'Entity was not found' },
  // 1003 — Template missing → HTTP 400
  { keywords: ['TEMPLATE CODE', 'TEMPLATE NOT FOUND'], code: 1003, httpStatus: 400, message: "Template code with bot doesn't exist" },
  // 2023 — Template missing (generic) → HTTP 200
  { keywords: ['TEMPLATE MISSING'],                    code: 2023, httpStatus: 200, message: 'Template Missing' },
  // 2024 — Template parameter mismatch → HTTP 200
  { keywords: ['TEMPLATE PARAM', 'PARAM MISMATCH'],    code: 2024, httpStatus: 200, message: 'Template Parameter Format Mismatch' },
  // 2005 — Auth failure → HTTP 401
  { keywords: ['AUTHORIZATION', 'CREDENTIALS', 'UNAUTHORIZED'], code: 2005, httpStatus: 401, message: 'Authorization failure' },
  // 2019 — Credit insufficient → HTTP 400
  { keywords: ['CREDIT INSUFFICIENT'],                 code: 2019, httpStatus: 400, message: 'Credit Insufficient' },
  // 1000 — Insufficient credit balance → HTTP 200
  { keywords: ['CREDIT', 'BALANCE', 'INSUFFICIENT'],   code: 1000, httpStatus: 200, message: 'Insufficient credit balance' },
  // 1001 — RCS Disabled → HTTP 200
  { keywords: ['RCS DISABLED', 'RCS NOT SUPPORTED'],   code: 1001, httpStatus: 200, message: 'Number is RCS Disabled' },
  // 2020 — Message empty → HTTP 403
  { keywords: ['MESSAGE EMPTY', 'EMPTY MESSAGE'],      code: 2020, httpStatus: 403, message: 'Message Empty' },
  // 2021 — Mobile number invalid → HTTP 200
  { keywords: ['MOBILE', 'PHONE NUMBER', 'INVALID NUMBER'], code: 2021, httpStatus: 200, message: 'Mobile Number Invalid' },
  // 2006 — Max length → HTTP 200
  { keywords: ['MAX LENGTH', 'TOO LONG', 'EXCEEDING'], code: 2006, httpStatus: 200, message: 'Exceeding max length' },
  // 2007 — Expired → HTTP 400
  { keywords: ['EXPIRED'],                             code: 2007, httpStatus: 400, message: 'Expired' },
  // 2008 — Undelivered → HTTP 401
  { keywords: ['UNDELIVERED', 'DELIVERY FAILED'],      code: 2008, httpStatus: 401, message: 'Undelivered' },
  // 2010 — Version unsupported → HTTP 400 (special: needs supportedVersion field)
  { keywords: ['VERSION UNSUPPORTED', 'VERSION NOT SUPPORTED'], code: 2010, httpStatus: 400, message: 'Version not supported' },
  // 2009 — Version unsupported (generic) → HTTP 200
  { keywords: ['VERSION'],                             code: 2009, httpStatus: 200, message: 'Version Unsupported' },
  // 2017 — Invalid message format → HTTP 429
  { keywords: ['INVALID FORMAT', 'INVALID MESSAGE FORMAT'], code: 2017, httpStatus: 429, message: 'Invalid Message Format' },
  // 2011 — Others → HTTP 200
  { keywords: ['OTHERS'],                              code: 2011, httpStatus: 200, message: 'Others' },
  // 2012 — DND → HTTP 400
  { keywords: ['DND'],                                 code: 2012, httpStatus: 400, message: 'DND Time' },
  // 2013 — Max retries → HTTP 400
  { keywords: ['RETRIES EXHAUSTED', 'MAX RETRIES'],    code: 2013, httpStatus: 400, message: 'Maximum Retries Exhausted' },
  // 2014 — Rate limit → HTTP 400
  { keywords: ['RATE LIMIT'],                          code: 2014, httpStatus: 400, message: 'Rate Limit Exceeded' },
  // 2015 — Throttled (auto-scaling) → HTTP 200
  { keywords: ['THROTTL'],                             code: 2015, httpStatus: 200, message: 'Rate Limit Exceeded (Throttled)' },
  // 2016 — Retries expired → HTTP 200
  { keywords: ['RETRIES EXPIRED'],                     code: 2016, httpStatus: 200, message: 'Retries Expired' },
  // 2025 — User not opted in → HTTP 200
  { keywords: ['OPTED OUT', 'INACTIVE', 'NOT OPTED'],  code: 2025, httpStatus: 200, message: 'User not Opted in or Inactive' },
];

/**
 * Dynamically maps a SPARC error message to the official WebEngage error spec.
 * @param {string} sparcError - Raw error string from SPARC API
 * @returns {{ code: number, httpStatus: number, message: string, supportedVersion?: string }}
 */
function mapWebEngageError(sparcError) {
  const errorUpper = (sparcError || '').toUpperCase();

  for (const mapping of WEBENGAGE_ERROR_MAP) {
    if (mapping.keywords.some(k => errorUpper.includes(k))) {
      const result = { code: mapping.code, httpStatus: mapping.httpStatus, message: mapping.message };
      // Special rule: statusCode 2010 MUST include supportedVersion
      if (mapping.code === 2010) {
        result.supportedVersion = '1.0';
      }
      return result;
    }
  }

  // 9988 — Unknown/uncovered error: pass through original SPARC message
  return { code: 9988, httpStatus: 400, message: sparcError || 'Unknown Error' };
}

module.exports = { mapWebEngageError };
