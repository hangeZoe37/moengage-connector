# SPARC Connector Hub: Complete System Architecture & Product Requirements Document

## 1. System Overview
**System Name:** SPARC Connector Hub (Multi-Vendor RCS/SMS Middleware)
**Definition:** The system is an intelligent **Integration Hub (Connector / Middleware)**. It sits between top-tier marketing automation platforms (MoEngage, CleverTap, WebEngage) and SPARC (Smartping’s CPaaS backend). 
**Core Purpose:** It abstracts the complexities of SPARC's API, payload formatting, DLT compliance, and fallback logic, allowing vendors to send RCS messages using their native JSON payloads and receive instant Delivery Receipts (DLRs) in their expected formats.

---

## 2. High-Level Architectural Flow
The system follows a strict **Controller-Service-Repository** design pattern.

1. **Vendor Request:** A vendor (e.g., CleverTap) fires a POST request with an RCS campaign payload.
2. **API & Routing (`src/routes`):** Express.js intercepts the route, applies Rate Limiting (20k req/min), and passes it to the Auth Middleware.
3. **Auth Middleware (`src/middleware`):** Validates Basic Auth or Bearer tokens by querying the `sparc_admin.clients` database. If valid, the request proceeds to the Controller.
4. **Controller Layer (`src/controllers`):** 
   - Validates the JSON payload.
   - Injects auto-prefixes to message IDs (`moe_`, `cl_`, `web_`) to prevent collisions.
   - Writes the initial `QUEUED` state to the specific vendor's isolated database.
   - Returns an immediate `200 OK` (Accepted) to the vendor so their systems don't hang.
   - Hands the payload off to the Service layer asynchronously.
5. **Service Layer (`src/services`):**
   - Translates the payload using pure mapping functions (`src/mappers`).
   - Dispatches the payload to SPARC APIs (`sparcClient.js`) using Axios with retry logic.
   - Interprets the SPARC response and updates the database with the SPARC Submission ID.
6. **Webhook & DLR Loop:** SPARC hits the unified `/sparc/webhook`. The system processes the DLR, translates it, and pushes it back to the originating vendor via `callbackDispatcher.js`.

---

## 3. Core Modules & Engine Deep Dive (What is actually happening)

### 3.1 The Inbound Engine & ID Collision Protection
Because different vendors might accidentally generate the same Message ID (e.g., `temp_12345`), the system employs an **Auto-Prefixing Algorithm**.
* The controllers silently append `moe_`, `cl_`, or `web_` to the incoming `messageId` before it touches the database. 
* This prefixed ID becomes the universal `callback_data` key throughout the entire lifecycle.

### 3.2 The SPARC Client (`sparcClient.js`)
This is the outbound communication nexus. It handles 3 distinct SPARC APIs:
* **RCS API (`/rcs/sendmessage`):** Sends primary Rich Communication Services payloads.
* **Standard SMS API (`/api/v1/send`):** Sends standard text fallback messages. It is strictly configured to use `unicode: 0` (GSM-7 encoding) to ensure strict DLT template compliance with Indian telecom operators and prevent silent carrier drops.
* **Link Tracking SMS API (`/api/v1/sendLink`):** Sends SMS messages that require URL click-tracking.
* **Resilience:** Wrapped in `axios-retry`. If SPARC throws a 5xx error or a network timeout occurs, it automatically applies exponential backoff and retries the request up to 3 times.

### 3.3 The Intelligent Fallback Engine (`fallbackEngine.js`)
This is the crown jewel of the system's reliability. It guarantees message delivery.
1. When an RCS message fails (either rejected by SPARC instantly, or bounces back later via a `RCS_DELIVERY_FAILED` webhook from a telecom operator), the DLR Controller catches it.
2. It inspects the original message's `fallback_order` array (e.g., `["rcs", "sms"]`).
3. If `sms` is present, it pulls the original `smsContent` or `smsData` block stored in the database.
4. It dynamically resolves the client's `rcs_assistant_id`.
5. It triggers the **Smart URL Tracking Engine** (see below) to check for links.
6. It fires the message to the SPARC SMS gateway.
7. It captures the SPARC `transactionId` and writes it to the `sparc_transaction_id` column in the database, allowing future SMS DLRs to map back to this fallback attempt.

### 3.4 Smart URL Tracking Engine (`urlProcessor.js` & `trackLinkRepo.js`)
When an SMS fallback is triggered, standard URLs inside the SMS are useless for analytics.
* The system queries the `sms_track_links` table for the client.
* A regex parser scans the SMS text body for URLs.
* If URLs are found, it strips them out, replaces them with `{tracking_url}` placeholders, and packages the actual URLs.
* It dynamically switches the outbound API call from SPARC's standard `/send` to the specialized `/sendLink` API, passing the `trackLinkId`. SPARC then generates short-links on the fly.

### 3.5 The Universal Webhook & Prefix Resolution Engine (`dlrController.js`)
SPARC sends all delivery updates (for all clients, all vendors, both RCS and SMS) to a single endpoint: `/sparc/webhook`.
* SPARC's payload arrives containing a `seqId` (which corresponds to our `callback_data`).
* **The Problem:** Sometimes SPARC drops prefixes, or vendors send irregular IDs.
* **The Resolution Algorithm:** The system first searches for an exact match. If it fails, it enters a multi-prefix resolution loop—it strips known prefixes (`cl_`, `moe_`, `web_`) and recursively searches the database by testing every prefix combination until it locates the parent message.
* Once found, it writes the DLR to the shared `dlr_events` table AND the isolated vendor `message_logs` table.
* It translates SPARC's internal status (e.g., `MESSAGE_DELIVERED_TO_CLIENT`) into the vendor's required status (e.g., `DELIVERED`).

### 3.6 Callback Dispatcher (`callbackDispatcher.js`)
Once a DLR is translated, it must be sent to the vendor.
* It wraps the HTTP POST to the vendor's webhook URL.
* If the vendor's server is down (e.g., 502 Bad Gateway) or times out, it queues the payload and retries up to 3 times with a 1-second delay.
* It logs every attempt (success or failure) to the `callback_dispatch_log` table for auditing.

---

## 4. Database Architecture (Siloed Multi-Tenant Setup)
To ensure strict vendor data privacy, prevent cross-contamination, and maximize query speed, the system uses 4 distinct MySQL databases running on connection pools (`DB_POOL_SIZE=50`).

1. **`sparc_admin` (Control Plane):**
   - `clients`: Stores tenant details, API credentials, Webhook URLs, and hashed passwords.
   - `admins`: Dashboard users.
2. **`sparc_moengage_db` (MoEngage Silo):**
   - `message_logs`: Contains `fallback_order`, `has_url`. No `callback_url` (MoEngage uses a global webhook).
3. **`sparc_clevertap_db` (CleverTap Silo):**
   - `message_logs`: Contains `callback_url` (CleverTap dictates DLR destinations per-message).
4. **`sparc_webengage_db` (WebEngage Silo):**
   - `message_logs`: Replaces `fallback_order` with `routing_details`. Excludes `has_url` and `sparc_transaction_id` (WebEngage handles routing differently).

**Fan-Out Queries:** When the system receives a query (like a webhook DLR) but doesn't know which vendor it belongs to, `messageRepo.js` utilizes `Promise.all` to execute a "fan-out" query across all 3 vendor databases simultaneously, returning the result from whichever database scores a hit.

---

## 5. Dashboard & Analytics (`dashboard-ui`)
A standalone React.js application provides real-time observability.
* **Contextual Login:** Admins select which connector (MoEngage, CleverTap, WebEngage) they are monitoring upon login. The API issues a JWT token bound to that specific connector.
* **Repository Segregation:** When the dashboard requests data, the Backend extracts the `connector_type` from the JWT and strictly queries ONLY that vendor's database.
* **Features:** Live pagination of logs, visual timelines, success/failure ratios, and channel distribution (RCS vs SMS Fallback).

---

## 6. Resilience, Security, and Edge Cases Handled

* **Connection Drain / Graceful Shutdown:** If the server receives a `SIGTERM` (e.g., during deployment), it stops accepting new HTTP requests, finishes processing active memory queues, gracefully drains all 4 MySQL connection pools, and then exits. This prevents corrupted database transactions.
* **Uncaught Exception Safety:** Handlers exist to catch rogue promise rejections or fatal exceptions, ensuring the PM2 process manager logs the exact stack trace before restarting the node.
* **DLT Compliance Protection:** Strict overriding of `unicode: 0` ensures that SMS fallbacks never fail silently at the carrier level due to UCS-2 vs GSM-7 encoding mismatches.
* **Payload Mismatch Safety:** Safe-navigation operators (`?.`) and fallback arrays (`|| ['rcs']`) are used everywhere so that if a vendor sends a malformed JSON payload (e.g., missing a `templateData` object), the Node.js server does not crash; it simply rejects the payload gracefully with a 400/2010 error code.
