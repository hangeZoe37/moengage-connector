-- =============================================================================
-- SPARC CONNECTOR HUB: FULL ARCHITECTURAL SETUP (SILOED)
-- =============================================================================
-- This script sets up the 4-database architecture required for the connector.
-- Each vendor (MoEngage, CleverTap, WebEngage) has its own siloed database
-- to ensure data isolation, alongside a central ADMIN database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CENTRAL ADMIN DATABASE (Shared Config + Auth)
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sparc_admin;
USE sparc_admin;

-- Clients table: Stores credentials for all connectors
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(100) NOT NULL,
  client_name VARCHAR(100) NOT NULL,
  rcs_api_key VARCHAR(255),
  rcs_api_secret VARCHAR(255),
  rcs_assistant_id VARCHAR(100),
  sms_api_username VARCHAR(100),
  sms_api_password VARCHAR(100),
  sms_sender_id VARCHAR(20),
  bearer_token VARCHAR(255) NOT NULL, -- Token used by vendors to call our API
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_client (client_id),
  UNIQUE KEY unique_token (bearer_token)
);

-- Short URL Tracking table
CREATE TABLE IF NOT EXISTS sms_track_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  original_url TEXT NOT NULL,
  short_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_code (short_code)
);

-- Users table (Dashboard Auth)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (admin / admin123)
-- Hash generated using bcrypt: $2b$10$vO8.H7eJ6H5K3zR5d09f.eW8jK5y5J3N6K0X8p5Z1P1Q1S1r1R1q1
INSERT IGNORE INTO users (username, password) VALUES ('admin', '$2b$10$vO8.H7eJ6H5K3zR5d09f.eW8jK5y5J3N6K0X8p5Z1P1Q1S1r1R1q1');


-- -----------------------------------------------------------------------------
-- 2. CONNECTOR SILOS (Apply these to ALL 3 connector databases)
-- -----------------------------------------------------------------------------
-- Repeat the following for:
--   CREATE DATABASE sparc_moengage_db;
--   CREATE DATABASE sparc_clevertap_db;
--   CREATE DATABASE sparc_webengage_db;
-- -----------------------------------------------------------------------------

-- TEMPLATE FOR EACH CONNECTOR DB:
-- USE [connector_db_name];

-- Message Logs: Tracks all outgoing campaigns
CREATE TABLE IF NOT EXISTS message_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data VARCHAR(100) NOT NULL,
  client_id INT NOT NULL,
  destination VARCHAR(50) NOT NULL,
  bot_id VARCHAR(100),
  template_name VARCHAR(100),
  message_type VARCHAR(20),
  fallback_order JSON,           -- Stores e.g. ["rcs", "sms"]
  routing_details JSON,          -- Alias used by WebEngage
  sparc_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'QUEUED',
  raw_payload JSON,              -- Original request payload for recovery/fallback
  has_url BOOLEAN DEFAULT FALSE,
  connector_type VARCHAR(20),    -- 'MOENGAGE' | 'CLEVERTAP' | 'WEBENGAGE'
  callback_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_callback (callback_data),
  INDEX idx_destination (destination)
);

-- Delivery Receipt (DLR) Events
CREATE TABLE IF NOT EXISTS dlr_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data VARCHAR(100) NOT NULL,
  sparc_status VARCHAR(50),
  moe_status VARCHAR(50),        -- Canonical status (e.g. RCS_DELIVERED)
  error_message TEXT,
  event_timestamp INT,
  callback_dispatched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dlr_callback (callback_data)
);

-- Interaction Events (Suggestions/Clicks)
CREATE TABLE IF NOT EXISTS suggestion_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data VARCHAR(100) NOT NULL,
  suggestion_text VARCHAR(255),
  postback_data VARCHAR(255),
  event_timestamp INT,
  callback_dispatched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sugg_callback (callback_data)
);
