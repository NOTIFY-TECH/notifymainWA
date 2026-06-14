-- contacts
UPDATE contacts
SET "phoneNumber" = REPLACE("phoneNumber", '@c.us', '@s.whatsapp.net')
WHERE "phoneNumber" LIKE '%@c.us';

-- conversations
UPDATE conversations
SET "phoneNumber" = REPLACE("phoneNumber", '@c.us', '@s.whatsapp.net')
WHERE "phoneNumber" LIKE '%@c.us';

-- messages
UPDATE messages
SET "fromNumber" = REPLACE("fromNumber", '@c.us', '@s.whatsapp.net')
WHERE "fromNumber" LIKE '%@c.us';

UPDATE messages
SET "toNumber" = REPLACE("toNumber", '@c.us', '@s.whatsapp.net')
WHERE "toNumber" LIKE '%@c.us';

-- campaign_contacts
UPDATE campaign_contacts
SET "phoneNumber" = REPLACE("phoneNumber", '@c.us', '@s.whatsapp.net')
WHERE "phoneNumber" LIKE '%@c.us';