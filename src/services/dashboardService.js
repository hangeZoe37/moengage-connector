'use strict';

/**
 * src/services/dashboardService.js
 * Central event hub for broadcasting message updates to the dashboard.
 * Uses a simple EventEmitter to push data to SSE (Server-Sent Events) clients.
 */

const EventEmitter = require('events');

class DashboardEmitter extends EventEmitter {}
const dashboardEmitter = new DashboardEmitter();

// Limit the number of listeners to prevent memory leaks if many tabs open
dashboardEmitter.setMaxListeners(50);

/**
 * Notify all connected dashboard clients of a new log entry or status update.
 * @param {string} type - 'message' or 'suggestion'
 * @param {object} data - The log entry data
 */
function notifyUpdate(type, data) {
  dashboardEmitter.emit('update', { type, data, timestamp: new Date().toISOString() });
}

module.exports = {
  dashboardEmitter,
  notifyUpdate
};
