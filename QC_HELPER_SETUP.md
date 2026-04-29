# QC Helper AI - RAG Setup Guide

## Overview

QC Helper AI adalah upgrade dari AI Chat yang sekarang fokus sebagai asisten Quality Control dengan pengetahuan lengkap tentang SOC (Station Observation Checklist) V.4.0 Mie Gacoan.

**Teknologi:**
- **RAG (Retrieval-Augmented Generation)** dengan Upstash Redis (Vercel KV)
- **Embeddings**: Gemini `text-embedding-004` (free tier)
- **LLM**: Gemini `gemini-2.0-flash-exp` (free tier)
- **Vector Search**: Cosine similarity

## Architecture

```
User Query
    ↓
Generate Embedding (Gemini)
    ↓
Search Redis (Top 3 chunks by cosine similarity)
    ↓
Inject relevant SOC chunks into system prompt
    ↓
Gemini generates response with SOC context
    ↓
Return answer to user
```

## Setup Steps

### 1. Vercel Blob Storage (SOC Document)

✅ **DONE** - SOC file uploaded to Vercel Blob

- Blob URL: `https://srau0bgt5vqz4agb.private.blob.vercel-storage.com/soc_master.md`
- Env var `BLOB_SOC_URL` added to all environments
- File size: 229KB (3054 lines)

### 2. Upstash Redis (KV) - Vector Storage

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project → **Storage** tab
3. Click **Create Database** → Choose **KV (Redis)**
4. Name: `waste-soc-vectors`
5. Region: Singapore (closest to users)
6. Click **Create**

Vercel will automatically add these environment variables:
```
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx
```

### 3. Gemini API Key

✅ **DONE** - Already configured

If not already set, add to Vercel environment variables:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get free API key from: https://aistudio.google.com/app/apikey

### 4. Deploy to Vercel

✅ **DONE** - Auto-deployed on push to main

```bash
git push origin main
```

Vercel will auto-deploy. Check status: https://vercel.com/markos-projects-49639f12/waste/deployments

### 4. Run SOC Ingestion

**IMPORTANT:** You must run ingestion ONCE to populate the vector database.

#### Option A: Via API (Recommended)

```bash
# Get your JWT token from browser localStorage (key: waste_app_token)
# Or login and copy from Network tab

curl -X POST https://your-domain.vercel.app/api/ingest-soc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Requirements:**
- Must be logged in as `super_admin` role
- Takes ~10-15 minutes (rate limited to 15 RPM for Gemini free tier)
- Generates ~150-200 chunks with embeddings

#### Option B: Local Script (Alternative)

```bash
# Create a one-time script
node scripts/ingest-soc-local.mjs
```

### 5. Verify Ingestion

```bash
curl https://your-domain.vercel.app/api/ingest-soc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "isIngested": true,
  "totalChunks": 187,
  "lastUpdated": "2026-04-30T10:30:00.000Z"
}
```

## Usage

### Frontend Integration

Update `src/pages/ai-assistant.tsx` to call `/api/qc-chat` instead of `/api/ai-chat`:

```typescript
const response = await apiFetch("/api/qc-chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: text,
    history: history,
    attachments: currentAttachments,
  }),
});
```

### Example Queries

**Good queries (will find relevant SOC chunks):**
- "Berapa cooking time mie Vinna?"
- "Apa parameter visual mie yang benar?"
- "Gimana cara bikin mie gacoan level 3?"
- "Standar berat bawang goreng per pack berapa?"
- "Apa saja yang harus dicek di station DIMSUM?"

**General queries (no SOC context needed):**
- "Halo, siapa kamu?"
- "Apa itu food safety?"
- "Tips mengurangi waste di restoran"

## Token Usage Estimation

### Gemini Free Tier Limits:
- **15 RPM** (requests per minute)
- **1M tokens/day**
- **1.5M tokens/month**

### Per Request Token Usage:

**Without RAG (old system):**
- Full SOC context: ~60,000 tokens
- Max requests/day: ~16 requests

**With RAG (new system):**
- Query embedding: ~100 tokens
- Top 3 chunks: ~1,500-2,000 tokens
- Response: ~500-1,000 tokens
- **Total: ~2,500 tokens/request**
- **Max requests/day: ~400 requests** ✅

**Efficiency gain: 25x more requests with same quota!**

## Maintenance

### Re-ingestion

If `soc_master.md` is updated:

1. Update the file in project root
2. Re-run ingestion:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/ingest-soc \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```
3. Old chunks will be automatically cleared and replaced

### Monitoring

Check Redis usage in Vercel Dashboard → Storage → KV:
- **Free tier**: 256MB storage
- **Estimated usage**: ~10-20MB for SOC vectors
- **Plenty of headroom** for future expansion

## Troubleshooting

### "No SOC chunks found in database"

**Cause:** Ingestion not run yet.
**Fix:** Run ingestion (see Step 4 above).

### "RAG system error"

**Cause:** Redis connection issue or missing env vars.
**Fix:** 
1. Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Vercel env vars
2. Verify Upstash Redis is active in Vercel Storage tab

### "Gemini embedding failed"

**Cause:** Invalid `GEMINI_API_KEY` or rate limit exceeded.
**Fix:**
1. Verify API key is correct
2. Check Gemini API quota: https://aistudio.google.com/app/apikey
3. Wait 1 minute if rate limited (15 RPM)

### Ingestion takes too long

**Expected:** 10-15 minutes for ~150-200 chunks (rate limited to 4s per chunk).
**If stuck:** Check Vercel function logs for errors.

## Files Changed

### New Files:
- `api/_lib/rag.ts` - RAG utilities (chunking, embeddings, search)
- `api/qc-chat.ts` - New QC Helper endpoint
- `api/ingest-soc.ts` - Ingestion endpoint
- `soc_master.md` - SOC document (235KB)
- `QC_HELPER_SETUP.md` - This file

### Modified Files:
- `package.json` - Added `@upstash/redis`
- `src/pages/ai-assistant.tsx` - Update to call `/api/qc-chat`

### Deprecated Files:
- `api/ai-chat.ts` - Old general AI chat (can be removed or kept as backup)

## Cost Analysis

### Vercel Hobby Plan:
- ✅ Upstash Redis (KV): **Free 256MB** (enough for SOC)
- ✅ Serverless Functions: **100GB-hours/month** (plenty)
- ✅ Bandwidth: **100GB/month**

### Gemini Free Tier:
- ✅ Embeddings: **Free** (no limit on `text-embedding-004`)
- ✅ Generation: **1M tokens/day** (400 requests/day with RAG)

**Total cost: $0/month** ✅

## Future Enhancements

1. **Multi-document support**: Add more knowledge bases (food safety, recipes, etc.)
2. **Hybrid search**: Combine vector search with keyword search
3. **Caching**: Cache frequent queries to save tokens
4. **Analytics**: Track which SOC sections are most queried
5. **Auto-update**: Webhook to re-ingest when SOC is updated

---

**Questions?** Contact: [Your contact info]
