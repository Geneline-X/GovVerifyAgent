# Location Support Guide

The agent now supports comprehensive location handling for problem reports.

## Features

### 1. WhatsApp Location Shares (Most Reliable)
Users can share their location directly from WhatsApp:
- Tap attachment → Location → Send Current Location
- Agent receives exact GPS coordinates
- Automatically validated and reverse-geocoded to get place name
- Marked as verified with ✓ if geocoding succeeds

**WhatsApp webhook format:**
```json
{
  "event": "message",
  "messageType": "location",
  "message": "Broken pipe here",
  "from": "2348012345678@c.us",
  "phoneE164": "+2348012345678",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "description": "Lagos, Nigeria"
  }
}
```

### 2. Text-Based Locations (Validated)
Users can describe locations in natural language:
- "Congo Market"
- "Bo Waterside"
- "Lumley Beach Road, Freetown"

The agent:
- Validates using OpenStreetMap Nominatim (free) or Google Maps API
- Checks if it's a real place in Nigeria
- Accepts skeptically if validation fails
- Marks confidence level: high/medium/low

### 3. Location Validation

**Free Option (Default): OpenStreetMap Nominatim**
- No API key required
- Rate limit: ~1 request/second
- Good for Nigerian locations
- Automatic reverse geocoding

**Premium Option: Google Maps API**
- Set `GOOGLE_MAPS_API_KEY` in `.env`
- Better accuracy and detail
- Costs apply after free tier

### 4. Database Schema

```prisma
model Problem {
  id              Int      @id @default(autoincrement())
  title           String
  locationText    String?  // "Ojodu market, Lagos" 
  latitude        Float?   // 6.5244
  longitude       Float?   // 3.3792
  locationVerified Boolean @default(false) // true if validation succeeded
  locationSource  String?  // "whatsapp_share" | "text_extracted" | "manual"
  // ... other fields
}
```

## User Flows

### Flow 1: Report with WhatsApp Location Share

1. User shares WhatsApp location + message "Broken water pipe"
2. Agent receives coordinates (8.4657, -13.2317)
3. Agent reverse-geocodes to "Congo Market, Freetown, Western Area, Sierra Leone"
4. Agent calls `report_problem` tool with coordinates
5. Response:
   ```
   Problem reported successfully! Problem number: 42.
   📍 Location: Congo Market, Freetown, Western Area, Sierra Leone ✓
   
   Share this number with neighbors so they can upvote.
   ```

### Flow 2: Report with Text Location

1. User: "There's uncollected garbage at Bo Waterside for 2 weeks"
2. Agent extracts location: "Bo Waterside"
3. Agent validates via Nominatim → finds "Bo Waterside, Bo, Southern Province, Sierra Leone"
4. Response:
   ```
   Problem reported successfully! Problem number: 43.
   📍 Location: Bo Waterside, Bo, Southern Province, Sierra Leone ✓
   
   Share this number with neighbors so they can upvote.
   ```

### Flow 3: Unverified Location (Skeptical Accept)

1. User: "Pothole at my street corner"
2. Agent extracts location: "my street corner"
3. Validation fails (not specific enough)
4. Response:
   ```
   Problem reported successfully! Problem number: 44.
   📍 Location: my street corner (Could not verify location - accepting skeptically)
   
   Share this number with neighbors so they can upvote.
   ```

## Configuration

### Environment Variables

```env
# Optional: Google Maps API (premium, more accurate)
GOOGLE_MAPS_API_KEY=AIza...

# If not set, uses free OpenStreetMap Nominatim
```

### Rate Limits

**Nominatim:**
- Max 1 request/second
- User-Agent header required
- Free for fair use

**Google Maps:**
- $200/month free credit
- Then $5 per 1000 requests (geocoding)
- $2 per 1000 requests (reverse geocoding)

## Web Dashboard Integration

Query problems with location data:

```typescript
// Get problems with coordinates (mappable)
const mappableProblems = await prisma.problem.findMany({
  where: {
    AND: [
      { latitude: { not: null } },
      { longitude: { not: null } }
    ]
  },
  orderBy: { upvoteCount: 'desc' }
});

// Get verified vs unverified
const verifiedProblems = await prisma.problem.findMany({
  where: { locationVerified: true }
});

// Get problems by location source
const whatsappSharedProblems = await prisma.problem.findMany({
  where: { locationSource: 'whatsapp_share' }
});
```

## Migration

After pulling this code:

```bash
# Generate Prisma client with new schema
npm run prisma:generate

# Create migration
npm run prisma:migrate

# This creates a migration adding:
# - latitude (Float?)
# - longitude (Float?)
# - locationVerified (Boolean default false)
# - locationSource (String?)
```

## Sierra Leone Context

The validator is optimized for Sierra Leone locations:
- Auto-adds "Sierra Leone" to search queries if not present
- Recognizes Sierra Leone keywords: Freetown, Bo, Kenema, District, Chiefdom, etc.
- Validates against Sierra Leone provinces, districts, and cities
- Major cities: Freetown, Bo, Kenema, Makeni, Koidu, Port Loko
- Provinces: Western Area, Eastern, Northern, Southern
- Flags locations outside Sierra Leone with medium confidence

## Testing

### Test WhatsApp Location Share

```bash
curl -X POST http://localhost:3800/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-agent-api-key" \
  -d '{
    "event": "message",
    "messageType": "location",
    "message": "Broken water pipe here",
    "from": "2348012345678@c.us",
    "phoneE164": "+2348012345678",
    "location": {
      "latitude": 8.4657,
      "longitude": -13.2317,
      "description": "Congo Market, Freetown"
    }
  }'
```

### Test Text Location

```bash
curl -X POST http://localhost:3800/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-agent-api-key" \
  -d '{
    "event": "message",
    "message": "Pothole at Lumley Beach Road for 3 months",
    "from": "23279648205@c.us",
    "phoneE164": "+23279648205"
  }'
```

## Best Practices

1. **Encourage WhatsApp location shares** - Most accurate
2. **Validate text locations** - Prevents typos and fake places
3. **Accept skeptically** - Don't block users if validation fails
4. **Show confidence indicators** - Use ✓ for verified locations
5. **Store original text** - Keep user's description even if geocoded
6. **Monitor validation failures** - Improve location extraction over time

## Future Enhancements

- [ ] Add location clustering (group problems in same area)
- [ ] Distance-based problem search ("problems near me")
- [ ] Heatmap visualization on web dashboard
- [ ] Location autocomplete suggestions
- [ ] Support for landmarks and informal place names
- [ ] Multi-language location names (Krio, Mende, Temne)
