'use strict';

/**
 * Dynamic CleverTap Error Mapper — Port 6001
 * API-Level (2000-2014) and Callback-Level (901-919) codes.
 * Ref: CleverTap RSP Integration Spec
 */

// ─── API-Level Error Map (Immediate Response) ─────────────────────────────
// All return HTTP 200 as per CleverTap spec.
const API_ERROR_MAP = [
  { keywords: ['CREDENTIALS', 'AUTHORIZATION', 'UNAUTHORIZED', 'AUTH'],  code: '2000', title: 'Invalid credentials' },
  { keywords: ['TEMPLATE PARAM', 'PARAM MISMATCH', 'INVALID TEMPLATE', 'TEMPLATE NAME'], code: '2001', title: 'Invalid template parameters' },
  { keywords: ['MOBILE', 'PHONE NUMBER', 'INVALID NUMBER', 'PHONE FORMAT'], code: '2002', title: 'Invalid phone number' },
  { keywords: ['NOT SUBSCRIBED', 'OPT-OUT', 'CONSENT', 'OPTED OUT'],     code: '2003', title: 'Phone number not subscribed' },
  { keywords: ['RCS DISABLED', 'RCS NOT SUPPORTED', 'RCS UNAVAILABLE'],  code: '2004', title: 'RCS Disabled for the number' },
  { keywords: ['ACCOUNT DISABLED', 'BILLING', 'SUSPENDED'],              code: '2005', title: 'Messaging Account Disabled' },
  { keywords: ['MEDIA', 'IMAGE', 'VIDEO', 'FILE URL'],                   code: '2006', title: 'Invalid Media' },
  { keywords: ['IP RESTRICTED', 'IP WHITELIS', 'SOURCE IP'],             code: '2007', title: 'Source IP Restricted' },
  { keywords: ['SENDER', 'BOT', 'ASSISTANT'],                            code: '2008', title: 'Invalid RCS sender ID' },
  { keywords: ['NO ACTIVE CONVERSATION', 'CONVERSATION EXPIRED'],        code: '2009', title: 'No Active Conversation' },
  { keywords: ['PERMITTED TIME', 'TIME WINDOW', 'OUTSIDE TIME'],         code: '2011', title: 'Outside Permitted Time Window' },
  { keywords: ['CONTENT POLICY', 'POLICY VIOLATION', 'BLOCKED CONTENT'], code: '2012', title: 'Content Policy Violation' },
  { keywords: ['PROMOTIONAL LIMIT', 'RATE LIMIT', 'LIMIT EXCEEDED'],     code: '2013', title: 'Promotional Message Limit Exceeded' },
];

// ─── Callback-Level Error Map (DLR Failures) ─────────────────────────────
const CALLBACK_ERROR_MAP = [
  { keywords: ['DND'],                                  code: '901',  title: 'DND Failure' },
  { keywords: ['SPAM'],                                 code: '902',  title: 'Spam Detection' },
  { keywords: ['BLACKLIST', 'OPTED OUT', 'COMPLAINT'],  code: '903',  title: 'Blacklist Rejection' },
  { keywords: ['SYSTEM ERROR', 'INTERNAL ERROR'],       code: '904',  title: 'System Error' },
  { keywords: ['SUBSCRIBER ERROR', 'INSUFFICIENT BALANCE', 'NETWORK'], code: '905', title: 'Subscriber Error' },
  { keywords: ['DLT HEADER'],                           code: '906',  title: 'DLT Header Blocked' },
  { keywords: ['DLT ENTITY'],                           code: '907',  title: 'DLT Entity Blocked' },
  { keywords: ['DLT TEMPLATE'],                         code: '908',  title: 'DLT Template Blocked' },
  { keywords: ['DLT CONSENT'],                          code: '909',  title: 'DLT Consent Error' },
  { keywords: ['INVALID SUBSCRIBER', 'INACTIVE'],       code: '910',  title: 'Invalid Subscriber' },
  { keywords: ['INBOX FULL'],                           code: '912',  title: 'Message Inbox Full' },
  { keywords: ['NDNC'],                                 code: '913',  title: 'NDNC Rejected' },
  { keywords: ['UNDELIVERED', 'DELIVERY FAILED'],       code: '914',  title: 'Undelivered' },
  { keywords: ['DROPPED', 'BANNED'],                    code: '915',  title: 'Dropped' },
  { keywords: ['FORCE EXPIRED'],                        code: '917',  title: 'Force Expired' },
  { keywords: ['DUPLICATE'],                            code: '918',  title: 'Duplicate Message Drop' },
  { keywords: ['DLT PLATFORM'],                         code: '919',  title: 'DLT Platform Failure' },
  { keywords: ['EXPIRED'],                              code: '916',  title: 'Expired' },
];

/**
 * Maps a raw SPARC API error to a CleverTap API error code (2000-2014).
 * @param {string} sparcError
 * @returns {string} CleverTap error code
 */
function mapCleverTapApiError(sparcError) {
  const errorUpper = (sparcError || '').toUpperCase();
  for (const mapping of API_ERROR_MAP) {
    if (mapping.keywords.some(k => errorUpper.includes(k))) return mapping.code;
  }
  return '2014'; // Others — any unclassified error
}

/**
 * Maps a SPARC DLR failure status to a CleverTap callback code (901-919).
 * @param {string} sparcStatus
 * @returns {string} CleverTap callback code
 */
function mapCleverTapCallbackError(sparcStatus) {
  const statusUpper = (sparcStatus || '').toUpperCase();
  for (const mapping of CALLBACK_ERROR_MAP) {
    if (mapping.keywords.some(k => statusUpper.includes(k))) return mapping.code;
  }
  return '914'; // Default: Undelivered
}

module.exports = { mapCleverTapApiError, mapCleverTapCallbackError };
