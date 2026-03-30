# Task: Map MoEngage → SPARC RCS Payloads

## Checklist
- [x] Read inboundMapper.js, validatePayload.js, sparcClient.js, constants.js, fallbackEngine.js, controller, routes
- [x] Read postman.json, MASTER_DOCUMENTATION.md, inboundMapper.test.js
- [x] Extract and read DOCX documentation for MoEngage format vs SPARC RCS format
- [x] Rewrite [inboundMapper.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/mappers/inboundMapper.js) with correct MoEngage→SPARC field mapping
  - [x] TEXT → SPARC plain text (with variables support)
  - [x] TEXT with suggestions → SPARC rich text with suggestions
  - [x] CARD → SPARC rich card (orientation, media, title, description, buttons)
  - [x] MEDIA → SPARC standalone media (image/video message)
- [x] Rewrite [validatePayload.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/src/middleware/validatePayload.js) schema strictly validating the MoEngage doc formats.
- [/] Update [postman.json](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/postman.json) with realistic sample payloads for all 3 MoEngage types
- [ ] Update [MASTER_DOCUMENTATION.md](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/MASTER_DOCUMENTATION.md) section 3.1 with new mapping table
- [ ] Update [tests/mappers/inboundMapper.test.js](file:///c:/Users/grace.jemima/Desktop/moengage-connector/moengage-connector/tests/mappers/inboundMapper.test.js) to match new field names
