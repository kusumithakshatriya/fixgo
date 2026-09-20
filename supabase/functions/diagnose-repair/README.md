# Diagnose Repair Edge Function

This Supabase Edge Function handles the secure execution of FixGo AI Diagnoses. It validates the user's mobile authentication token, verifies database ownership of the repair request, triggers an AI analysis, and securely commits the result into the database utilizing a privileged service role.

## 1. Prerequisites

You must have the Supabase CLI installed and linked to your project.
```bash
# Install Supabase CLI (if you haven't already)
npm install -g supabase

# Login to Supabase CLI
supabase login

# Link your local directory to your remote FixGo project
supabase link --project-ref your-project-id
```

## 2. How to Deploy

To push this function to your live Supabase project, execute:
```bash
supabase functions deploy diagnose-repair
```
> **Note**: Do not deploy automatically without validating your project credentials.

## 3. Configuring Secrets (For Phase 8 / Real AI)

Currently, the function uses a provider-independent Development Mock. 
When you are ready to plug in a real AI provider (e.g. OpenAI), you will inject the secret into your Supabase Edge Function environment variables.

**NEVER put the AI key in your React Native source code or `.env`.**

Set the secret securely via CLI:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-real-key
```

Then, you can access it in `index.ts` using:
```typescript
const aiKey = Deno.env.get('OPENAI_API_KEY');
```

## 4. Local Testing

You can serve Edge Functions locally utilizing the Supabase CLI to verify functionality before deployment.
```bash
supabase start
supabase functions serve diagnose-repair
```
This binds the function to your local machine (typically `http://127.0.0.1:54321/functions/v1/diagnose-repair`) and connects to your local Supabase emulator or remote DB depending on your `.env.local` configuration.

## 5. How to Test the Function

You can test the function using `curl`, Postman, or your frontend.

### Example POST Body
The endpoint strictly accepts `POST` requests with a JSON body containing a valid `request_id` (UUID).

```json
{
  "request_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Curl Test Example
To test this successfully, you must provide a valid `Authorization` token for the user who owns the `service_request`.

```bash
curl -i --request POST 'https://your-project-id.supabase.co/functions/v1/diagnose-repair' \
  --header 'Authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"request_id":"123e4567-e89b-12d3-a456-426614174000"}'
```

If successful, the response will be:
```json
{
  "success": true,
  "diagnosis": {
    "diagnosis": "Based on your description of \"The AC is blowing warm air...\", this appears to be a typical AC Repair issue.",
    "severity": "MEDIUM",
    "confidence": 85.5,
    "estimated_min": 350,
    "estimated_max": 900,
    "parts_estimate": 400,
    "labor_estimate": 300,
    "recommendation": "Ensure the appliance is disconnected from power before technicians arrive. Your attached media has been reviewed."
  }
}
```

## 6. Current Implementation Status

**⚠️ EXPLICIT NOTICE:** The current AI Provider acts purely as a **DEVELOPMENT MOCK**.
- It simulates an artificial 2000ms delay.
- It returns static INR (₹) estimates.
- **Real AI Vision is NOT yet enabled.** The attached media count is passed to the Mock, but raw image bytes/videos are not securely transmitted or analyzed by any Computer Vision model yet.
- This layer exists solely to unblock front-end UI integration safely.
