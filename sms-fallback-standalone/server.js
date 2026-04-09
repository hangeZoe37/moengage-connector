'use strict';

/**
 * sms-fallback-standalone/server.js
 * 
 * 100% Standalone API tailored purely for handling RCS-to-SMS Fallback.
 * Accepts MoEngage Payload, Maps to SPARC RCS, sends SMS on failure.
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { mapMessageToSparc } = require('./mapper');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Maps `callback_data` (seq_id) -> { smsConfig: Object, timestamp: Number }
const memoryCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > 48 * 60 * 60 * 1000) {
      memoryCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

const bearerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== process.env.BEARER_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid bearer token' });
  }
  next();
};

async function triggerSmsFallback(destination, smsConfig) {
    console.log(`[SMS-FALLBACK] Triggering SMS to ${destination}`);
    
    if (!smsConfig || !smsConfig.message || !smsConfig.sender) {
        console.warn(`[SMS-FALLBACK] Cannot fallback to SMS: Missing 'smsConfig.message' or 'smsConfig.sender' for ${destination}`);
        return;
    }

    try {
        const smsBaseUrl = process.env.SPARC_SMS_API_BASE_URL;
        const toNumber = destination.replace(/^\+/, ''); 

        const params = {
          username: process.env.SPARC_SMS_USERNAME,
          password: process.env.SPARC_SMS_PASSWORD,
          unicode: true,
          from: smsConfig.sender,
          text: smsConfig.message,
          to: toNumber,
        };

        if (smsConfig.template_id && smsConfig.template_id !== "null") {
          params.dltContentId = smsConfig.template_id;
        }

        const smsResponse = await axios.post(`${smsBaseUrl}/api/v1/send`, null, {
            params,
            timeout: 10000,
            headers: { accept: 'application/json' },
        });

        console.log(`[SMS-FALLBACK] Sent via SMS Gateway. TxID: ${smsResponse.data?.transactionId || 'N/A'}`);
    } catch (error) {
        console.error(`[SMS-FALLBACK] SMS Gateway Error: ${error.message}`);
    }
}

// 1. Primary Endpoint: Receive MoEngage Request -> Map -> RCS -> SMS Feedback
app.post('/api/sms-fallback/send', bearerAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.messages || !Array.isArray(payload.messages)) {
    return res.status(400).json({ error: 'Payload must contain a non-empty messages array' });
  }

  // Quickly ack to client
  res.status(202).json(payload.messages.map(m => ({
    status: 'SUCCESS',
    callback_data: m.callback_data
  })));

  setImmediate(async () => {
    const sparcRcsUrl = process.env.SPARC_RCS_API_URL || 'https://prodbackendrcs.sparc.smartping.io/backend/api/v2/rcs/sendmessage';
    const rcsUsername = process.env.SPARC_RCS_USERNAME;
    const rcsPassword = process.env.SPARC_RCS_PASSWORD;

    // Send the RCS DLR to the external webhook.site / bin.h00k.dev link for manual testing
    const localDlrUrl = process.env.STANDALONE_DLR_URL || 'https://bin.h00k.dev/886d7d9e-46ef-4d92-a596-01baebfc4d8d';

    for (const moEngageMsg of payload.messages) {
       if (moEngageMsg.callback_data && moEngageMsg.sms) {
           memoryCache.set(moEngageMsg.callback_data, {
               smsConfig: moEngageMsg.sms,
               timestamp: Date.now(),
               destination: moEngageMsg.destination
           });
       }

       try {
           const sparcPayload = mapMessageToSparc(moEngageMsg, localDlrUrl);

           // Send the payload directly to SPARC RCS API
           const sparcRcsResponse = await axios.post(sparcRcsUrl, sparcPayload, {
               headers: {
                   'Content-Type': 'application/json',
                   'serviceAccountName': rcsUsername,
                   'apiPassword': rcsPassword
               }
           });

           console.log(`[SMS-FALLBACK] SPARC RCS Accepted mapped payload with status ${sparcRcsResponse.status}`);
           
           // Handle immediate inline failures
           const responseData = sparcRcsResponse.data;
           console.log(`[SMS-FALLBACK] SPARC RCS Response Data:`, JSON.stringify(responseData));

           // If SPARC returns array of objects with 'status': 'FAILED'
           if (Array.isArray(responseData)) {
               // Checking explicitly for failed statuses like FAILED or REJECTED
               const failedItem = responseData.find(i => {
                   if (!i.status) return false;
                   const s = i.status.toUpperCase();
                   return s === 'FAILED' || s === 'REJECTED' || s === 'ERROR';
               });
               
               if (failedItem) {
                   console.log(`[SMS-FALLBACK] RCS API inline rejection detected. Triggering instant SMS fallback.`);
                   await triggerSmsFallback(moEngageMsg.destination, moEngageMsg.sms);
               }
           } else if (responseData && Array.isArray(responseData.failed) && responseData.failed.length > 0) {
               console.log(`[SMS-FALLBACK] RCS API inline rejection detected in failed array. Triggering instant SMS fallback.`);
               await triggerSmsFallback(moEngageMsg.destination, moEngageMsg.sms);
           }

       } catch (error) {
           console.error(`[SMS-FALLBACK] Direct API Failure to SPARC RCS: ${error.message}. Triggering SMS from Catch Block.`);
           await triggerSmsFallback(moEngageMsg.destination, moEngageMsg.sms);
       }
    }
  });
});

// 2. DLR Endpoint: Receive delayed webhooks from SPARC RCS
app.post('/api/sms-fallback/dlr', async (req, res) => {
    const dlrPayload = req.body;
    res.status(200).send('OK');

    setImmediate(async () => {
        try {
            if (!dlrPayload || !dlrPayload.eventData) return;

            // SPARC nests eventType inside entity
            const eventType = dlrPayload.eventData.entity?.eventType || dlrPayload.eventData.eventType;
            const seqId = dlrPayload.seqId || dlrPayload.eventData.seqId; 

            console.log(`[SMS-FALLBACK] Received DLR for seqId: ${seqId}, eventType: ${eventType}`);

            const failedEvents = ['MESSAGE_DELIVERY_FAILED', 'MESSAGE_UNDELIVERED', 'FAILED', 'UNDELIVERED', 'REJECTED', 'SEND_MESSAGE_FAILURE'];

            if (failedEvents.includes(eventType)) {
                 if (seqId && memoryCache.has(seqId)) {
                     const cached = memoryCache.get(seqId);
                     console.log(`[SMS-FALLBACK] Delayed RCS DLR Failed. Found in memory cache! Triggering SMS fallback.`);
                     await triggerSmsFallback(cached.destination, cached.smsConfig);
                     memoryCache.delete(seqId);
                 } else {
                     console.warn(`[SMS-FALLBACK] Cannot fallback. SeqId ${seqId} not found in memory cache.`);
                 }
            } 
            else if (eventType === 'MESSAGE_DELIVERED') {
                 if (seqId) memoryCache.delete(seqId);
            }
        } catch (err) {
            console.error(`[SMS-FALLBACK] DLR processing error: ${err.message}`);
        }
    });
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sms-fallback-standalone' });
});

const PORT = process.env.FALLBACK_API_PORT || 4000;
app.listen(PORT, () => {
  console.log(`[SMS-FALLBACK] Standalone RCS-to-SMS Fallback API running on port ${PORT}`);
});
