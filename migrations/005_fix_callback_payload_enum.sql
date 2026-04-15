-- migrations/005_fix_callback_payload_enum.sql
-- Expand payload_type ENUM to support CleverTap status and interaction logs.

ALTER TABLE callback_dispatch_log 
MODIFY COLUMN payload_type ENUM('STATUS', 'SUGGESTION', 'CLEVERTAP_STATUS', 'CLEVERTAP_INTERACTION');
