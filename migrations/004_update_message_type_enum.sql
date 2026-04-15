-- migrations/004_update_message_type_enum.sql

ALTER TABLE message_logs 
MODIFY COLUMN message_type ENUM('TEXT', 'CARD', 'MEDIA', 'CAROUSEL', 'TEMPLATE');
