const { mapInboundPayload } = require('./src/mappers/inboundMapper');

const moEngagePayload = {
  "messages": [
    {
      "destination": "+919990927990",
      "callback_data": "1235_cb",
      "fallback_order": ["RCS"],
      "rcs": {
        "bot_id": "677baf920f6d1f157306740b",
        "template_id": "templateName123",
        "message_content": {
          "type": "CARD",
          "data": {
            "title": "Welcome John",
            "description": "John is welcomed",
            "parameters": {
              "name": "John"
            }
          }
        }
      }
    }
  ]
};

const [sparcPayload] = mapInboundPayload(moEngagePayload, "https://mock.dlr/");
console.log(JSON.stringify(sparcPayload, null, 2));
