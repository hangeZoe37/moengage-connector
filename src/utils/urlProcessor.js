'use strict';

/**
 * src/utils/urlProcessor.js
 * Logic for detecting target URLs in SMS text and replacing them with SPARC placeholders.
 */

const logger = require('../config/logger');

/**
 * Processes message text for tracked links.
 * 
 * @param {string} text - The original SMS message text
 * @param {Array<{target_url: string, track_link_id: string}>} mappings - Client's URL mappings
 * @returns {object} { modifiedText: string, trackLinkIds: string, hasUrl: boolean }
 */
function processMessageLinks(text, mappings) {
  if (!text || !mappings || !Array.isArray(mappings) || mappings.length === 0) {
    return { modifiedText: text, trackLinkIds: '', hasUrl: false };
  }

  let modifiedText = text;
  const foundTrackLinkIds = [];
  let matchCount = 0;

  // Sort mappings by target_url length descending to match longest URLs first (prevents partial matches)
  const sortedMappings = [...mappings].sort((a, b) => b.target_url.length - a.target_url.length);

  for (const mapping of sortedMappings) {
    // Escape target_url for use in regex
    const escapedUrl = mapping.target_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedUrl, 'gi');

    if (regex.test(modifiedText)) {
      // Find the placeholder for this match
      const placeholder = matchCount === 0 ? '{tracking_url}' : `{tracking_url_${matchCount}}`;
      
      // Replace all occurrences of this target_url
      modifiedText = modifiedText.replace(regex, placeholder);
      
      foundTrackLinkIds.push(mapping.track_link_id);
      matchCount++;
    }
  }

  const hasUrl = foundTrackLinkIds.length > 0;
  
  return {
    modifiedText,
    trackLinkIds: foundTrackLinkIds.join(','),
    hasUrl
  };
}

module.exports = {
  processMessageLinks
};
