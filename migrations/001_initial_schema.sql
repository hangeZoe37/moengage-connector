-- migrations/001_initial_schema.sql
-- All CREATE TABLE statements for the SPARC-MoEngage Connector.
-- Run once: mysql -u sparc_connector -p sparc_moengage < migrations/001_initial_schema.sql

-- ============================================================
-- Table 1: workspace_tokens
-- One row per MoEngage client workspace.
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_tokens (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id   VARCHAR(100) UNIQUE NOT NULL,  -- MoEngage workspace identifier
  bearer_token   VARCHAR(255) NOT NULL,          -- token from "Authentication: Bearer <token>" header
  moe_dlr_url    VARCHAR(500) NOT NULL,          -- MoEngage DLR URL for this workspace
  sparc_account  VARCHAR(100),                   -- SPARC serviceAccountName for this workspace
  sparc_password VARCHAR(255),                   -- SPARC apiPassword for this workspace
  is_active      TINYINT(1) DEFAULT 1,           -- 0 = disabled without deleting
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table 2: message_logs
-- One row per message received from MoEngage.
-- ============================================================
CREATE TABLE IF NOT EXISTS message_logs (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data    VARCHAR(200) NOT NULL,   -- MoEngage reconciliation key (= SPARC seq_id)
  workspace_id     VARCHAR(100),            -- which client sent this
  destination      VARCHAR(20),             -- phone number E.164
  bot_id           VARCHAR(100),            -- SPARC assistant_id
  template_name    VARCHAR(100),            -- null for international users
  message_type     ENUM('TEXT','CARD','MEDIA'),              -- CAROUSEL not yet supported by MoEngage
  fallback_order   JSON,                    -- e.g. ["rcs","sms"]
  sparc_message_id VARCHAR(100),            -- message_id we sent to SPARC
  status           ENUM(
                     'QUEUED',
                     'RCS_SENT','RCS_SENT_FAILED',
                     'RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ',
                     'SMS_SENT','SMS_SENT_FAILED',
                     'SMS_DELIVERED','SMS_DELIVERY_FAILED',
                     'DONE'
                   ) DEFAULT 'QUEUED',
  raw_payload      JSON,                    -- full MoEngage payload (debug only)
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_callback_data (callback_data),
  INDEX idx_workspace_id  (workspace_id),
  INDEX idx_created_at    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table 3: dlr_events
-- One row per delivery status event received from SPARC.
-- ============================================================
CREATE TABLE IF NOT EXISTS dlr_events (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,  -- links to message_logs.callback_data
  sparc_status         VARCHAR(50),            -- raw SPARC status string (TODO: confirm exact values)
  moe_status           VARCHAR(50),            -- mapped MoEngage enum value
  error_message        TEXT,                   -- only present for FAILED statuses
  event_timestamp      BIGINT,                 -- epoch seconds from SPARC
  callback_dispatched  TINYINT(1) DEFAULT 0,   -- 1 when MoEngage confirmed receipt
  created_at           TIMESTAMP DEFAULT NOW(),
  INDEX idx_callback_data (callback_data),
  INDEX idx_moe_status    (moe_status),
  INDEX idx_created_at    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table 4: suggestion_events
-- One row per user tap on an RCS suggestion button.
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestion_events (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data    VARCHAR(200),   -- links to original message
  suggestion_text  VARCHAR(500),   -- button label the user tapped
  postback_data    VARCHAR(500),   -- postback value from original message
  event_timestamp  BIGINT,
  callback_dispatched TINYINT(1) DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  INDEX idx_callback_data (callback_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table 5: callback_dispatch_log
-- Every attempt to POST back to MoEngage's DLR URL.
-- ============================================================
CREATE TABLE IF NOT EXISTS callback_dispatch_log (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data  VARCHAR(200),  -- which message this dispatch is for
  payload_type   ENUM('STATUS','SUGGESTION'),
  attempt_number TINYINT,       -- 1, 2, or 3
  http_status    SMALLINT,      -- HTTP response code from MoEngage (null if timeout)
  success        TINYINT(1),    -- 1 = MoEngage returned 2xx
  error_message  TEXT,          -- timeout message or HTTP error body
  dispatched_at  TIMESTAMP DEFAULT NOW(),
  INDEX idx_callback_data (callback_data),
  INDEX idx_success       (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
