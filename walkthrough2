# Walkthrough: MoEngage to SPARC RCS Payload Mapping

I have successfully mapped the MoEngage payloads for TEXT, CARD, and MEDIA to SPARC's RCS format based on the provided documentation (`moengae send msgs.docx` and `swagger rcs.docx`). Here is a detailed breakdown of the changes and how the mapping works.

## 1. Updated [inboundMapper.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/mappers/inboundMapper.js)
The payload mapping logic in [src/mappers/inboundMapper.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/mappers/inboundMapper.js) has been completely rewritten to accurately reflect the documentation.

### The Mapping Logic
*   **Deep Content Nesting:** The MoEngage webhook places the message content deep inside the payload as `message.rcs.message_content`. Furthermore, all actual message data (like text, title, parameters) is nested inside a `data` object (e.g., `message_content.data.parameters`).
*   **Reconciliation Key:** `message.callback_data` from MoEngage is mapped directly to `seq_id` in SPARC. This is critical for asynchronously matching SPARC's DLR webhooks back to the original MoEngage request.
*   **Phone Numbers:** MoEngage sends `destination` in E.164 format (with a `+`). SPARC typically expects this without the `+`, so it is stripped.
*   **Templates & Variables:** SPARC uses a template-based system (`template_name`). The dynamic data is passed in a `variables` block.
    *   **TEXT:** Mapped into an Array of variables. `content.data.parameters` keys are ignored, and the values are sequentially assigned to SPARC variables `{{1}}`, `{{2}}`, etc.
    *   **CARD / MEDIA:** Mapped into an Object. `content.data.title` becomes `card_title_variables: [{name: "{{1}}", value: title}]`. `content.data.description` and any `parameters` are combined in order into `card_variables: [{name: "{{1}}", value: desc}, {name: "{{2}}", value: param1}... ]`.
*   **Suggestions/Buttons:** Suggestions are formatted into SPARC's specific Action Array format. However, note that SPARC's documentation primarily relies on the pre-configured template to handle the rendering of these buttons, so mapping them dynamically through the API is often not required if the template has them hardcoded.

## 2. Updated [validatePayload.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/middleware/validatePayload.js)
The Zod validation schema in [src/middleware/validatePayload.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/middleware/validatePayload.js) was updated to accurately enforce the nested structure described in the MoEngage documentation (validating `message_content`, `data`, `data.parameters`, `data.title`, etc.).

It also includes a small backwards-compatibility hoist: it hoists `message.rcs.message_content` up to `message.content` during validation so the rest of the application (including the new mapper) can access it easily without changing every file in the codebase.

## 3. Updated [postman.json](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/postman.json)
I have injected realistic sample payloads directly into the [postman.json](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/postman.json) collection for all three supported MoEngage message types.
You can now easily test end-to-end flows for:
1.  **MoEngage Inbound Send - TEXT (with param)**
2.  **MoEngage Inbound Send - CARD (Rich Card)**
3.  **MoEngage Inbound Send - MEDIA**

## 4. Updated [MASTER_DOCUMENTATION.md](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/MASTER_DOCUMENTATION.md)
I updated **Section 3.1: Payload Mapping Rules** in the [MASTER_DOCUMENTATION.md](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/MASTER_DOCUMENTATION.md) to explain the deep content nesting (`message.rcs.message_content.data`) and the array vs object variable formatting required by SPARC.

## 5. Updated Tests
I updated [tests/mappers/inboundMapper.test.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/tests/mappers/inboundMapper.test.js) to match the new mapper logic. Specifically, changing how it passes parameters (`content.data.parameters`) and asserting the new SPARC output formats. Note: I ran `npm test tests/mappers/inboundMapper.test.js` and all unit tests passed successfully.

## How to Test
You can now import the updated [postman.json](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/postman.json) into Postman and fire the three sample requests to your local server to verify they are correctly transformed and logged.
