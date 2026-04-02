const mapper = require('./src/mappers/inboundMapper.js');
const payload = {
    "messages": [
        {
            "destination": "+919990927990",
            "callback_data": "moe_media123",
            "fallback_order": [
                "rcs"
            ],
            "rcs": {
                "bot_id": "677baf920f6d1f157306740b",
                "template_id": "null",
                "message_content": {
                    "type": "MEDIA",
                    "data": {
                        "media_url": "https://i.pinimg.com/736x/4d/38/44/4d38448ec324f090135ce75e8dcdca79.jpg",
                        "content_type": "IMAGE"
                    },
                    "suggestions": [
                        {
                            "type": "OPEN_URL",
                            "text": "Learn More",
                            "postback_data": "URL_CLICKED",
                            "url": "https://moengage.com"
                        },
                        {
                            "type": "DIAL_PHONE",
                            "text": "Call Support",
                            "postback_data": "DIAL_CLICKED",
                            "phone": "+919999999999"
                        }
                    ]
                }
            }
        }
    ]
};
console.log(JSON.stringify(mapper.mapInboundPayload(payload, 'http://dlr')[0], null, 2));
