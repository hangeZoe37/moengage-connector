const { mapInboundPayload } = require('./src/mappers/inboundMapper');

const moEngagePayload = {
  "messages": [
    {
      "destination": "+919990927990",
      "callback_data": "cb_card_001",
      "fallback_order": ["RCS"],
      "rcs": {
        "bot_id": "677baf920f6d1f157306740b",
        "message_content": {
          "type": "CARD",
          "data": {
            "media": {
              "media_url": "https://images.weserv.nl/?url=wowbouquet.com/images/2025/02/dahlia-scaled.webp&output=jpg",
              "content_type": "IMAGE"
            },
            "title": "Welcome GRACE to Moengage",
            "description": "GRACE is happily welcomed to Moengage team",
            "orientation": "VERTICAL",
            "height": "MEDIUM",
            "parameters": {
              "name": "GRACE",
              "team": "Product"
            }
          },
          "suggestions": [
            {
              "type": "DIAL_PHONE",
              "text": "Call Now",
              "postback_data": "SA1L1C1",
              "phone": "+9186867475"
            },
            {
              "type": "REPLY",
              "text": "Suggestion #2",
              "postback_data": "suggestion_2"
            },
            {
              "type": "SHOW_LOCATION",
              "text": "Visit Now",
              "postback_data": "SA1L1C1",
              "latitude": "21.5937",
              "longitude": "78.9629",
              "label": "Label - Show Location"
            },
            {
              "type": "REPLY",
              "text": "Know More",
              "postback_data": "SR1L1C0"
            },
            {
              "type": "CREATE_CAL_EVENT",
              "text": "Mark Your Calendar",
              "postback_data": "SA1L1C1",
              "start_time": "2023-06-26T15:01:23Z",
              "end_time": "2023-06-26T18:01:23Z",
              "title": "Bot Development Seminar",
              "description": "Session 1 of 4"
            },
            {
              "type": "DIAL_PHONE",
              "text": "Dial Now",
              "postback_data": "SA1L1C1",
              "phone": "+9186867475"
            },
            {
              "type": "REPLY",
              "text": "STOP Messaging",
              "postback_data": "STOP"
            }
          ]
        }
      }
    }
  ]
};

const DLR_URL = "https://bin.h00k.dev/174f5f6e-0fe1-48dd-ab7f-7dc7bf932088";

const [sparcPayload] = mapInboundPayload(moEngagePayload, DLR_URL);
console.log(JSON.stringify(sparcPayload.messages[0].content.richCardDetails.standalone.content.suggestions, null, 2));
