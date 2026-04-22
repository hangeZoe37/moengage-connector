-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: sparc_webengage_db
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `sparc_webengage_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `sparc_webengage_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `sparc_webengage_db`;

--
-- Table structure for table `callback_dispatch_log`
--

DROP TABLE IF EXISTS `callback_dispatch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `callback_dispatch_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `callback_data` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_number` tinyint DEFAULT NULL,
  `http_status` smallint DEFAULT NULL,
  `success` tinyint(1) DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `dispatched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_callback_data` (`callback_data`),
  KEY `idx_success` (`success`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bearer_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rcs_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rcs_password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rcs_assistant_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sms_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sms_password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bearer_token` (`bearer_token`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (1,'Default Test Client','5d537485610c0e3ec8914ab337bd60b57c6f8b091b9d7e7361498c00bc713e51','tstrcs444','6?aRp2xyk@Zw%(<b3','677baf920f6d1f157306740b','testotp01.trans','4!-o3)=0<4bd-+F74',1,'2026-04-09 08:34:54','2026-04-22 05:50:44');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dlr_events`
--

DROP TABLE IF EXISTS `dlr_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dlr_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `callback_data` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sparc_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moe_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `event_timestamp` bigint DEFAULT NULL,
  `callback_dispatched` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_callback_data` (`callback_data`),
  KEY `idx_dispatched` (`callback_dispatched`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;



--
-- Table structure for table `message_logs`
--

DROP TABLE IF EXISTS `message_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `callback_data` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int DEFAULT NULL,
  `destination` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bot_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `routing_details` json DEFAULT NULL,
  `sparc_message_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sparc_transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('QUEUED','RCS_SENT','RCS_SENT_FAILED','RCS_DELIVERED','RCS_DELIVERY_FAILED','RCS_READ','SMS_SENT','SMS_SENT_FAILED','SMS_DELIVERED','SMS_DELIVERY_FAILED','DONE') COLLATE utf8mb4_unicode_ci DEFAULT 'QUEUED',
  `raw_payload` json DEFAULT NULL,
  `connector_type` enum('MOENGAGE','CLEVERTAP','WEBENGAGE') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_callback_data` (`callback_data`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;



--
-- Table structure for table `sms_track_links`
--

DROP TABLE IF EXISTS `sms_track_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_track_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int DEFAULT NULL,
  `target_url` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `track_link_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_track_links`
--

LOCK TABLES `sms_track_links` WRITE;
/*!40000 ALTER TABLE `sms_track_links` DISABLE KEYS */;
INSERT INTO `sms_track_links` VALUES (1,1,'https://smartping.ai/','129242','2026-04-10 07:58:12');
/*!40000 ALTER TABLE `sms_track_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suggestion_events`
--

DROP TABLE IF EXISTS `suggestion_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suggestion_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `callback_data` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suggestion_text` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postback_data` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_timestamp` bigint DEFAULT NULL,
  `callback_dispatched` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_callback_data` (`callback_data`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;




/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-22 14:19:00
