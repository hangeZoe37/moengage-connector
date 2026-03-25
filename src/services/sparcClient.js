'use strict';

/**
 * src/services/sparcClient.js
 * All SPARC API calls. Axios with workspace credentials.
 */

const axios = require('axios');
const { env } = require('../config/env');
const { SPARC_REQUEST_TIMEOUT_MS } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Create an Axios instance pre-configured with SPARC auth headers for a workspace.
 * @param {object} workspace - Workspace row from DB
 * @returns {import('axios').AxiosInstance}
 */
function createClient(workspace) {
  return axios.create({
    baseURL: env.SPARC_API_BASE_URL,
    timeout: SPARC_REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'serviceAccountName': workspace.sparc_account || env.SPARC_SERVICE_ACCOUNT,
      'apiPassword': workspace.sparc_password || env.SPARC_API_PASSWORD,
    },
  });
}

/**
 * Send an RCS message via SPARC.
 * POST {SPARC_API_BASE_URL}/rcs/sendmessage
 *
 * @param {object} workspace - Workspace row from DB
 * @param {object} sparcPayload - SPARC-formatted payload from inboundMapper
 * @returns {Promise<object>} SPARC API response data
 */
async function sendRCS(workspace, sparcPayload) {
  const client = createClient(workspace);

  logger.info('Calling SPARC RCS sendmessage', {
    workspaceId: workspace.workspace_id,
    messageId: sparcPayload.messages?.[0]?.message_id,
  });

  try {
    const response = await client.post('/rcs/sendmessage', sparcPayload);

    logger.info('SPARC RCS sendmessage succeeded', {
      workspaceId: workspace.workspace_id,
      messageId: sparcPayload.messages?.[0]?.message_id,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    logger.error('SPARC RCS sendmessage failed', {
      workspaceId: workspace.workspace_id,
      messageId: sparcPayload.messages?.[0]?.message_id,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

/**
 * Send an SMS message via SPARC (fallback).
 * POST {SPARC_API_BASE_URL}/sms/sendmessage
 *
 * TODO: Confirm exact path with SPARC team
 * TODO: Confirm SMS payload structure with SPARC team
 *
 * @param {object} workspace - Workspace row from DB
 * @param {object} smsData - SMS data from MoEngage payload
 * @param {string} destination - Phone number
 * @param {string} assistantId - SPARC assistant ID
 * @returns {Promise<object>} SPARC API response data
 */
async function sendSMS(workspace, smsData, destination, assistantId) {
  const client = createClient(workspace);

  const smsPayload = {
    messages: [
      {
        sender: smsData.sender,
        template_id: smsData.template_id || null,
        message: smsData.message,
        destination: destination.replace('+', ''),
        assistant_id: assistantId,
      },
    ],
  };

  logger.info('Calling SPARC SMS sendmessage', {
    workspaceId: workspace.workspace_id,
    destination,
  });

  try {
    const response = await client.post('/sms/sendmessage', smsPayload);

    logger.info('SPARC SMS sendmessage succeeded', {
      workspaceId: workspace.workspace_id,
      destination,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    logger.error('SPARC SMS sendmessage failed', {
      workspaceId: workspace.workspace_id,
      destination,
      error: error.message,
      status: error.response?.status,
    });
    throw error;
  }
}

/**
 * Fetch assistants from SPARC.
 * GET {SPARC_API_BASE_URL}/rcs/fetchassistants
 *
 * @param {object} workspace - Workspace row from DB
 * @returns {Promise<object>}
 */
async function fetchAssistants(workspace) {
  const client = createClient(workspace);

  try {
    const response = await client.get('/rcs/fetchassistants');
    return response.data;
  } catch (error) {
    logger.error('SPARC fetchassistants failed', {
      workspaceId: workspace.workspace_id,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { sendRCS, sendSMS, fetchAssistants, createClient };
