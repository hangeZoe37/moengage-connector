-- migrations/final_schema.sql
-- UNIFIED SCHEMA: MoEngage & CleverTap to SPARC Connector
-- Run once to reset/clean: mysql -u root -p sparc_moengage < migrations/final_schema.sql

-- ============================================================
-- 0. CLEANUP (Drop views then tables)
-- ============================================================
DROP VIEW IF EXISTS message_logs;
DROP VIEW IF EXISTS dlr_events;
DROP VIEW IF EXISTS suggestion_events;
DROP VIEW IF EXISTS callback_dispatch_log;

DROP TABLE IF EXISTS moengage_callback_dispatch_log;
DROP TABLE IF EXISTS clevertap_callback_dispatch_log;
DROP TABLE IF EXISTS moengage_suggestion_events;
DROP TABLE IF EXISTS clevertap_suggestion_events;
DROP TABLE IF EXISTS moengage_dlr_events;
DROP TABLE IF EXISTS clevertap_dlr_events;
DROP TABLE IF EXISTS moengage_message_logs;
DROP TABLE IF EXISTS clevertap_message_logs;
DROP TABLE IF EXISTS sms_track_links;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS clients;

-- ============================================================
-- 1. GLOBAL TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admins (username, password_hash) VALUES ('admin', '$2b$10$1VAQWk4FYlFIRizOdI8OCO5dwdt5KiWWaBLBt.oy7/xj1CAaUlDs2');

CREATE TABLE IF NOT EXISTS clients (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_name      VARCHAR(100) NOT NULL,
  bearer_token     VARCHAR(255) UNIQUE NOT NULL,
  rcs_username     VARCHAR(100),
  rcs_password     VARCHAR(255),
  rcs_assistant_id VARCHAR(100),
  sms_username     VARCHAR(100),
  sms_password     VARCHAR(255),
  is_active        TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO clients (client_name, bearer_token, rcs_username, rcs_password, rcs_assistant_id)
VALUES (
  'Default Test Client',
  'REPLACE_WITH_SECURE_BEARER_TOKEN',
  NULL,
  NULL,
  NULL
);

CREATE TABLE IF NOT EXISTS sms_track_links (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_id      INT,
  target_url     VARCHAR(512) NOT NULL,
  track_link_id  VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_client_id (client_id),
  CONSTRAINT fk_sms_track_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. MOENGAGE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS moengage_message_logs (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,
  client_id            INT,
  destination          VARCHAR(20),
  bot_id               VARCHAR(100),
  template_name        VARCHAR(100),
  message_type         ENUM('TEXT','CARD','MEDIA'),
  fallback_order       JSON,
  sparc_message_id     VARCHAR(100),
  sparc_transaction_id VARCHAR(100),
  status               ENUM(
                         'QUEUED',
                         'RCS_SENT','RCS_SENT_FAILED',
                         'RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ',
                         'SMS_SENT','SMS_SENT_FAILED',
                         'SMS_DELIVERED','SMS_DELIVERY_FAILED',
                         'DONE'
                       ) DEFAULT 'QUEUED',
  raw_payload          JSON,
  has_url              TINYINT(1) DEFAULT 0,
  connector_type       ENUM('MOENGAGE', 'CLEVERTAP', 'WEBENGAGE') DEFAULT 'MOENGAGE',
  callback_url         VARCHAR(512) DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),

  INDEX idx_callback_data      (callback_data),
  INDEX idx_client_id          (client_id),
  INDEX idx_created_at         (created_at),
  INDEX idx_sparc_txn_id       (sparc_transaction_id),
  INDEX idx_status             (status),
  CONSTRAINT fk_moe_client_log FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moengage_dlr_events (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,
  sparc_status         VARCHAR(50),
  moe_status           VARCHAR(50),
  error_message        TEXT,
  event_timestamp      BIGINT,
  callback_dispatched  TINYINT(1) DEFAULT 0,
  created_at           TIMESTAMP DEFAULT NOW(),

  INDEX idx_callback_data      (callback_data),
  INDEX idx_dispatched         (callback_dispatched),
  INDEX idx_created_at         (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moengage_suggestion_events (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data       VARCHAR(200),
  suggestion_text     VARCHAR(500),
  postback_data       VARCHAR(500),
  event_timestamp     BIGINT,
  callback_dispatched TINYINT(1) DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW(),

  INDEX idx_callback_data (callback_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moengage_callback_dispatch_log (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data  VARCHAR(200),
  payload_type   ENUM('STATUS','SUGGESTION', 'CLEVERTAP_STATUS', 'CLEVERTAP_INTERACTION', 'WEBENGAGE_STATUS', 'WEBENGAGE_INTERACTION'),
  attempt_number TINYINT,
  http_status    SMALLINT,
  success        TINYINT(1),
  error_message  TEXT,
  dispatched_at  TIMESTAMP DEFAULT NOW(),

  INDEX idx_callback_data (callback_data),
  INDEX idx_success       (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 3. CLEVERTAP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS clevertap_message_logs (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,
  client_id            INT,
  destination          VARCHAR(20),
  bot_id               VARCHAR(100),
  template_name        VARCHAR(100),
  message_type         ENUM('TEXT','CARD','MEDIA'),
  fallback_order       JSON,
  sparc_message_id     VARCHAR(100),
  sparc_transaction_id VARCHAR(100),
  status               ENUM(
                         'QUEUED',
                         'RCS_SENT','RCS_SENT_FAILED',
                         'RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ',
                         'SMS_SENT','SMS_SENT_FAILED',
                         'SMS_DELIVERED','SMS_DELIVERY_FAILED',
                         'DONE'
                       ) DEFAULT 'QUEUED',
  raw_payload          JSON,
  has_url              TINYINT(1) DEFAULT 0,
  connector_type       ENUM('MOENGAGE', 'CLEVERTAP', 'WEBENGAGE') DEFAULT 'CLEVERTAP',
  callback_url         VARCHAR(512) DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),

  INDEX idx_callback_data      (callback_data),
  INDEX idx_client_id          (client_id),
  INDEX idx_created_at         (created_at),
  INDEX idx_sparc_txn_id       (sparc_transaction_id),
  INDEX idx_status             (status),
  CONSTRAINT fk_ct_client_log  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clevertap_dlr_events LIKE moengage_dlr_events;
CREATE TABLE IF NOT EXISTS clevertap_suggestion_events LIKE moengage_suggestion_events;
CREATE TABLE IF NOT EXISTS clevertap_callback_dispatch_log LIKE moengage_callback_dispatch_log;


-- ============================================================
-- 4. WEBENGAGE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS webengage_message_logs (
  id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  callback_data        VARCHAR(200) NOT NULL,
  client_id            INT,
  destination          VARCHAR(20),
  bot_id               VARCHAR(100),
  template_name        VARCHAR(100),
  message_type         VARCHAR(20),
  fallback_order       JSON,
  sparc_message_id     VARCHAR(100),
  sparc_transaction_id VARCHAR(100),
  status               ENUM(
                         'QUEUED',
                         'RCS_SENT','RCS_SENT_FAILED',
                         'RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ',
                         'SMS_SENT','SMS_SENT_FAILED',
                         'SMS_DELIVERED','SMS_DELIVERY_FAILED',
                         'DONE'
                       ) DEFAULT 'QUEUED',
  raw_payload          JSON,
  has_url              TINYINT(1) DEFAULT 0,
  connector_type       ENUM('MOENGAGE', 'CLEVERTAP', 'WEBENGAGE') DEFAULT 'WEBENGAGE',
  callback_url         VARCHAR(512) DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),

  INDEX idx_callback_data      (callback_data),
  INDEX idx_client_id          (client_id),
  INDEX idx_created_at         (created_at),
  INDEX idx_sparc_txn_id       (sparc_transaction_id),
  INDEX idx_status             (status),
  CONSTRAINT fk_we_client_log  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webengage_dlr_events LIKE moengage_dlr_events;
CREATE TABLE IF NOT EXISTS webengage_suggestion_events LIKE moengage_suggestion_events;
CREATE TABLE IF NOT EXISTS webengage_callback_dispatch_log LIKE moengage_callback_dispatch_log;


-- ============================================================
-- 5. VIEWS (To make dashboard reads seamless)
-- ============================================================

CREATE OR REPLACE VIEW message_logs AS
SELECT * FROM moengage_message_logs
UNION ALL
SELECT * FROM clevertap_message_logs
UNION ALL
SELECT * FROM webengage_message_logs;

CREATE OR REPLACE VIEW dlr_events AS
SELECT * FROM moengage_dlr_events
UNION ALL
SELECT * FROM clevertap_dlr_events
UNION ALL
SELECT * FROM webengage_dlr_events;

CREATE OR REPLACE VIEW suggestion_events AS
SELECT * FROM moengage_suggestion_events
UNION ALL
SELECT * FROM clevertap_suggestion_events
UNION ALL
SELECT * FROM webengage_suggestion_events;

CREATE OR REPLACE VIEW callback_dispatch_log AS
SELECT * FROM moengage_callback_dispatch_log
UNION ALL
SELECT * FROM clevertap_callback_dispatch_log
UNION ALL
SELECT * FROM webengage_callback_dispatch_log;
