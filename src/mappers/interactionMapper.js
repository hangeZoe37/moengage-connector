'use strict';

/**
 * src/mappers/interactionMapper.js
 * SPARC postback → MoEngage SUGGESTION_CLICKED format.
 * PURE FUNCTION — no DB, no API calls, no side effects.
 */

/**
 * Maps a SPARC interaction/postback event to MoEngage SUGGESTION_CLICKED format.
 * @param {object} sparcEvent - Raw interaction event from SPARC
 * @returns {object} MoEngage-formatted suggestion event payload
 */
function mapInteractionEvent(sparcEvent) {
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;

  // Convert ISO 8601 string or existing Epoch to Unix timestamp seconds
  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (sparcEvent.timestamp) {
    const parsed = Math.floor(new Date(sparcEvent.timestamp).getTime() / 1000);
    if (!isNaN(parsed)) {
      timestampSeconds = parsed;
    }
  }

  return {
    events: [
      {
        type: 'SUGGESTION_CLICKED',
        // Strip internal prefix so MoEngage gets the original ID back
        callback_data: callbackData ? String(callbackData).replace(/^moe_/, '') : callbackData,
        timestamp: String(timestampSeconds),
        data: {
          text: sparcEvent.suggestion_text || sparcEvent.text || '',
          postback_data: sparcEvent.postback_data || sparcEvent.postback || '',
        },
      },
    ],
  };
}

module.exports = { mapInteractionEvent };
