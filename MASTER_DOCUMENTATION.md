# SPARC-MoEngage RCS Connector - Master Documentation

This document serves as the absolute source of truth for the MoEngage to SPARC (Smartping) RCS/SMS Connector. It is designed to be read by **human developers** and **AI assistants** to rapidly understand the entire architecture, data flow, and third-party API payloads.

---

## 🏗️ 1. System Overview

The **SPARC-MoEngage RCS Connector** is an Express (Node.js) middleware application. It sits between **MoEngage** (a marketing automation platform) and **SPARC** (an RCS and SMS provider).

Its primary responsibilities are:
1. **Receive MoEngage webhooks:** Accept RCS send requests (which may contain SMS fallback instructions) from MoEngage.
2. **Translate Payloads:** Convert MoEngage's generic JSON payload into SPARC's proprietary RCS and SMS payloads.
3. **Orchestrate Fallbacks:** Attempt to send an RCS message first. If RCS fails, immediately attempt to send an SMS fallback (if permitted by the payload).
4. **Reconcile Callbacks (DLRs):** Receive asynchronous Delivery Receipts (DLRs) from SPARC, translate the statuses back to MoEngage's formats, and securely transmit them back to MoEngage using exponential backoff.

### 🚨 Critical Architectural Constraint: The 5-Second Rule
MoEngage strictly enforces a **5-second timeout** on its outbound webhook (`POST /integrations/moengage/rcs/send`). 
To solve this, the connector uses an asynchronous processing model in `src/routes/inbound.js`. When a request arrives, the Express route immediately returns an HTTP 200 `{"status": "QUEUED"}` response back to MoEngage. The actual API calls to SPARC are then pushed to the Node Event Loop via `setImmediate()` to run in the background.

---

## 📂 2. Codebase Journey & Folder Structure

We follow a strict layered architecture to prevent spaghetti code.

* **`/server.js` & `src/app.js`**: The entry point. Wires up Express, middleware, and routes. No business logic.
* **`src/middleware/`**: Authentication (`bearerAuth.js`), Rate Limiting (`rateLimiter.js`), and Zod Payload Validation (`validatePayload.js`).
* **`src/routes/`**: Pure HTTP handlers. Receives inbound JSON, shapes the HTTP response, and hands off to controllers.
* **`src/controllers/`**: Orchestrators. They manage the flow (e.g., Extract message -> Save to DB -> Call Mapper -> Call Service). They do not write SQL or make HTTP API calls.
* **`src/mappers/`**: **Pure Functions.** They handle all JSON translation (MoEngage format <-> SPARC format). No side-effects.
   * `inboundMapper.js`: Maps MoEngage requests to SPARC RCS API. **CRITICAL:** Maps MoEngage's `callback_data` into SPARC's `seq_id` to allow future reconciliation.
   * `dlrMapper.js`: Translates SPARC DLR statuses (e.g., "delivered") into MoEngage statuses (e.g., "RCS_DELIVERED").
* **`src/services/`**: Core Business Logic and 3rd-Party HTTP API interacting.
   * `sparcClient.js`: Contains `axios` clients to talk to the SPARC RCS API and SPARC SMS API.
   * `fallbackEngine.js`: Reads the `fallback_order` array from MoEngage and decides whether to send RCS, SMS, or both.
   * `callbackDispatcher.js`: Dispatches DLRs back to MoEngage with automatic retries on failure.
* **`src/repositories/`**: The ONLY place SQL is written. (Using `mysql2`).

---

## 🔄 3. The Message Journey (Data Flow)

1. **MoEngage requests a Send**:
   - `POST /integrations/moengage/rcs/send` is hit.
   - `validatePayload` ensures the JSON has all required fields.
   - `inbound` route immediately returns `{ success: true, messages: [{ status: "QUEUED" }] }`.
2. **Background Processing Begins**:
   - `inboundController.js` loops through messages and passes them to `fallbackEngine.js`.
3. **RCS Attempt (`fallbackEngine.js`)**:
   - The engine checks `fallback_order.includes("rcs")`.
   - `inboundMapper.js` translates the payload.
   - `sparcClient.sendRCS` makes an HTTP call to SPARC.
   - If **SUCCESS**: The message is saved to DB as `RCS_SENT`. An `RCS_SENT` callback is fired to MoEngage.
   - If **FAILURE**: The engine updates DB to `RCS_FAILED`. It then checks if `sms` is in the `fallback_order`.
4. **SMS Fallback Attempt (`fallbackEngine.js`)**:
   - If permitted, `sparcClient.sendSMS` makes an HTTP call to SPARC's SMS API.
   - Fires `SMS_SENT` or `SMS_FAILED` back to MoEngage.
5. **SPARC Asynchronous Webhooks (DLRs)**:
   - SPARC hits our webhook `POST /sparc/dlr`.
   - `dlrController.js` receives it. It looks up the `seq_id` (which matches MoEngage's `callback_data`).
   - `dlrMapper.js` translates the status array.
   - `callbackDispatcher.js` sends the final status back to MoEngage.

### 🧩 3.1 Payload Mapping Rules & Required Entities (The Gotchas)
To successfully bridge MoEngage to SPARC, our mappers enforce the following strict entity translations from the MoEngage webhook payload:

1. **`assistant_id` (RCS Bot):** MoEngage sends this as `message.rcs.bot_id`. We map this to SPARC's `assistant_id` for RCS delivery.
2. **`dltContentId` (SMS Template):** For India DLT compliance, SPARC SMS requires a `dltContentId`. We pull this from `message.sms.template_id`. (There is also an optional `dltPrincipalEntityId` which can be sent in the XML API, but for JSON we rely on `dltContentId`).
3. **Deep Content Nesting:** MoEngage does NOT put message content at the root. The content is deeply buried in `message.rcs.message_content.data`. Our `validatePayload.js` and `inboundMapper.js` are specifically built to dig into this nested object to extract `title`, `description`, etc.
4. **`seq_id` (Reconciliation Key):** MoEngage sends a 200-character max `callback_data` string. We pass this exactly as-is into SPARC's `seq_id` field. When SPARC fires a DLR webhook back to us, we use their `seq_id` to tell MoEngage exactly which message was delivered.

---

## 🔌 4. API References & Authenticaton Specifications

This project communicates with **THREE** distinct APIs: SPARC RCS, SPARC SMS, and MoEngage Callbacks.

### A. SPARC RCS API
* **Base URL:** Defined via `SPARC_API_BASE_URL` (e.g., `https://stagingbackendocmpv2.smartping.io/backend/api/v2`)
* **Endpoint:** `POST /rcs/sendmessage`
* **Authentication:** API Key Header-Based.
  * Header: `serviceAccountName: <YOUR_ACCOUNT>`
  * Header: `apiPassword: <YOUR_PASSWORD>`
* **Payload Structure:** Template-based or variable-based. Variables are structured as Arrays (for Text) or Objects (for Cards/Carousels).
* **Code Location:** `src/services/sparcClient.js` -> `createRcsClient()` and `sendRCS()`

### B. SPARC SMS API
* **Base URL:** Defined via `SPARC_SMS_API_BASE_URL` (e.g., `https://domainname/fe/api/v1`)
* **Endpoint:** `POST /message` (JSON Method)
* **Authentication:** **Basic Auth.**
  * Header: `Authorization: Basic <base64(username:password)>`
* **Payload Highlights:** India DLT compliance requires `dltContentId`.
* **Sample Payload:**
```json
{
  "extra": {"dltContentId": "ContentID"},
  "message": { "recipient": "919999999999", "text": "Hello world!" },
  "sender": "TEST",
  "unicode": false
}
```
* **Code Location:** `src/services/sparcClient.js` -> `createSmsClient()` and `sendSMS()`

### C. MoEngage DLR Callbacks
* **Base URL:** Extracted from Workspace DB (`moe_dlr_url`) OR fallback env var `MOENGAGE_DLR_URL` (e.g., `https://api-01.moengage.com/rcs/dlr/sparc`).
* **Format Requirements:**
```json
{
  "statuses": [
    {
      "status": "RCS_DELIVERED",
      "callback_data": "123_Moe_ABC",
      "timestamp": "1672345678"
    }
  ]
}
```
* **Code Location:** `src/services/callbackDispatcher.js`

---

## 🚀 5. Getting Started & Maintenance

1. **Database:** Ensure MySQL 8 is running. Execute `/migrations/001_initial_schema.sql` to build tables.
2. **Environment:** Copy `.env.example` to `.env` and fill out DB, Server, SPARC RCS, and SPARC SMS credentials.
3. **Start:** `npm install` followed by `npm run dev`.

### Future AI Assistant Instructions
If an AI agent is modifying this repo in the future:
* **NEVER** write SQL in Controllers or Services. Only edit `Repositories`.
* **NEVER** mutate payloads inside Controllers. Only edit `Mappers`.
* **NEVER** build synchronous `await` blocks inside `src/routes/inbound.js` that might exceed 5 seconds. Use `setImmediate()`.
* Ensure `seq_id` and `callback_data` are perfectly strictly maintained across all mappers for correct database reconciliation.
