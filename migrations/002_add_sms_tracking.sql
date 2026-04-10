-- migrations/002_add_sms_tracking.sql

-- 1. Add has_url flag to message_logs
ALTER TABLE message_logs 
ADD COLUMN has_url TINYINT(1) DEFAULT 0 AFTER raw_payload,
ADD INDEX idx_has_url (has_url);

-- 2. Create sms_track_links table for URL mappings
CREATE TABLE IF NOT EXISTS sms_track_links (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_id      INT NOT NULL,
  target_url     VARCHAR(500) NOT NULL,
  track_link_id  VARCHAR(50) NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  
  -- Indexing for fast lookups during message processing
  INDEX idx_client_target (client_id, target_url),
  
  CONSTRAINT fk_track_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
