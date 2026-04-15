-- migrations/003_add_clevertap_support.sql

ALTER TABLE message_logs 
ADD COLUMN connector_type ENUM('MOENGAGE', 'CLEVERTAP') DEFAULT 'MOENGAGE' AFTER client_id,
ADD COLUMN callback_url VARCHAR(512) DEFAULT NULL AFTER connector_type;

-- Update existing logs to MoEngage
UPDATE message_logs SET connector_type = 'MOENGAGE' WHERE connector_type IS NULL;
