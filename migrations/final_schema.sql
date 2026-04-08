-- migrations/final_schema.sql
-- UNIFIED SCHEMA: MoEngage-SPARC Connector
-- Run once to reset/clean: mysql -u root -p sparc_moengage < migrations/final_schema.sql

-- ============================================================
-- 0. CLEANUP (Start Fresh)
-- ============================================================
DROP TABLE IF EXISTS callback_dispatch_log;
DROP TABLE IF EXISTS suggestion_events;
DROP TABLE IF EXISTS dlr_events;
DROP TABLE IF EXISTS message_logs;
DROP TABLE IF EXISTS workspace_tokens; -- Old format
DROP TABLE IF EXISTS clients;          -- New format

-- ============================================================
-- 1. Table: clients
-- Dashboard managed tokens and SPARC credentials.
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_name      VARCHAR(100) NOT NULL,          -- e.g. "Acme Corp"
  bearer_token     VARCHAR(255) UNIQUE NOT NULL,   -- MoEngage authorization token for this client
  rcs_username     VARCHAR(100),                   -- SPARC RCS Service Account Name
  rcs_password     VARCHAR(255),                   -- SPARC RCS Password
  rcs_assistant_id VARCHAR(100),                   -- SPARC RCS Assistant ID (bot_id override)
  sms_username     VARCHAR(100),                   -- SPARC SMS Service Account Name
  sms_password     VARCHAR(255),                   -- SPARC SMS Password
  is_active        TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Table: message_logs
-- Central log for all incoming requests.
-- ============================================================
CREATE TABLE IF NOT EXISTS message_logs (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data    VARCHAR(200) NOT NULL,   -- MoEngage reconciliation key (= SPARC seq_id)
  client_id        INT,                     -- which dashboard client sent this
  destination      VARCHAR(20),             -- phone number E.164
  bot_id           VARCHAR(100),            -- SPARC assistant_id
  template_name    VARCHAR(100),            -- null for international users
  message_type     ENUM('TEXT','CARD','MEDIA'),
  fallback_order       JSON,                    -- e.g. ["rcs","sms"]
  sparc_message_id     VARCHAR(100),            -- message_id for RCS (submissionId)
  sparc_transaction_id VARCHAR(100),            -- transactionId for SMS
  status               ENUM(
                     'QUEUED',
                     'RCS_SENT','RCS_SENT_FAILED',
                     'RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ',
                     'SMS_SENT','SMS_SENT_FAILED',
                     'SMS_DELIVERED','SMS_DELIVERY_FAILED',
                     'DONE'
                   ) DEFAULT 'QUEUED',
  raw_payload      JSON,                    -- debug only
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_callback_data (callback_data),
  INDEX idx_client_id  (client_id),
  INDEX idx_created_at    (created_at),
  CONSTRAINT fk_client_log FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Table: dlr_events
-- Raw DLR tracking for audit.
-- ============================================================
CREATE TABLE IF NOT EXISTS dlr_events (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,
  sparc_status         VARCHAR(50),
  moe_status           VARCHAR(50),
  error_message        TEXT,
  event_timestamp      BIGINT,
  callback_dispatched  TINYINT(1) DEFAULT 0,
  created_at           TIMESTAMP DEFAULT NOW(),
  INDEX idx_callback_data (callback_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Table: suggestion_events
-- RCS interaction tracking.
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestion_events (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data    VARCHAR(200),
  suggestion_text  VARCHAR(500),
  postback_data    VARCHAR(500),
  event_timestamp  BIGINT,
  callback_dispatched TINYINT(1) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  INDEX idx_callback_data (callback_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. Table: callback_dispatch_log
-- Outbound log for MoEngage callbacks.
-- ============================================================
CREATE TABLE IF NOT EXISTS callback_dispatch_log (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data  VARCHAR(200),
  payload_type   ENUM('STATUS','SUGGESTION'),
  attempt_number TINYINT,
  http_status    SMALLINT,
  success        TINYINT(1),
  error_message  TEXT,
  dispatched_at  TIMESTAMP DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. DEFAULT TEST CLIENT
-- ============================================================
INSERT INTO clients (client_name, bearer_token, rcs_username, rcs_password, rcs_assistant_id)
VALUES (
  'Local Test Client',
  'YOUR_BEARER_TOKEN_HERE',
  'tstrcs444',
  '6?aRp2xyk@Zw%(<b3',
  '677baf920f6d1f157306740b'
);
