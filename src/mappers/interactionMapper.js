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
  // TODO: Confirm exact field names with SPARC team
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;

  return {
    events: [
      {
        type: 'SUGGESTION_CLICKED',
        callback_data: callbackData,
        timestamp: String(Math.floor(sparcEvent.timestamp || Date.now() / 1000)),
        data: {
          text: sparcEvent.suggestion_text || sparcEvent.text || '',
          postback_data: sparcEvent.postback_data || sparcEvent.postback || '',
        },
      },
    ],
  };
}

module.exports = { mapInteractionEvent };
