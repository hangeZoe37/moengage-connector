'use strict';

const webengageService = require('../services/webengageService');
const logger = require('../config/logger');
const { mapWebEngageError } = require('../utils/errorMapper');

async function handleInbound(req, res) {
  try {
    const result = await webengageService.processInbound(req.body, req.client);

    // ✅ Spec Example 1: Message Accepted Successfully
    // Must return ONLY status + statusCode. No message field.
    return res.status(200).json({
      status: 'rcs_accepted',
      statusCode: 0
    });

  } catch (error) {
    const mappedError = mapWebEngageError(error.message);

    // ✅ Spec Example 2 & 3: Message rejected — always include message field
    const rejectionPayload = {
      status: 'rcs_rejected',
      statusCode: mappedError.code,
      message: mappedError.message
    };

    // ✅ Special Rule: statusCode 2010 MUST include supportedVersion: "1.0"
    if (mappedError.code === 2010) {
      rejectionPayload.supportedVersion = '1.0';
    }

    logger.error('WebEngage submission REJECTED', {
      reason: error.message,
      payload: rejectionPayload
    });

    return res.status(mappedError.httpStatus).json(rejectionPayload);
  }
}

module.exports = { handleInbound };
