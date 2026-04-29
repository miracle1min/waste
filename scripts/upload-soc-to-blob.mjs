import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

/**
 * Upload soc_master.md to Vercel Blob Storage
 * 
 * Prerequisites:
 * 1. Create Blob store in Vercel Dashboard (Storage tab)
 * 2. Run: vercel env pull .env.local
 * 
 * Run: node scripts/upload-soc-to-blob.mjs
 */

async function uploadSocToBlob() {
  try {
    // Check for token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment');
      console.log('\nSetup steps:');
      console.log('1. Go to https://vercel.com/dashboard → Storage → Create Blob store');
      console.log('2. Copy BLOB_READ_WRITE_TOKEN from env vars');
      console.log('3. Add to .env.local: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx');
      process.exit(1);
    }
    
    console.log('[Upload] Reading soc_master.md...');
    const filePath = path.join(process.cwd(), 'soc_master.md');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Error: soc_master.md not found in project root');
      process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`[Upload] File size: ${(content.length / 1024).toFixed(2)} KB`);
    
    // Upload to Vercel Blob
    console.log('[Upload] Uploading to Vercel Blob...');
    const blob = await put('soc_master.md', content, {
      access: 'private', // Private store
      contentType: 'text/markdown',
      addRandomSuffix: false, // Keep consistent filename
    });
    
    console.log('[Upload] ✅ Upload successful!');
    console.log('[Upload] Blob URL:', blob.url);
    
    console.log('\n📝 Next steps:');
    console.log('1. Add to .env.local:');
    console.log(`   BLOB_SOC_URL=${blob.url}`);
    console.log('\n2. Add to Vercel env vars (Production):');
    console.log(`   vercel env add BLOB_SOC_URL`);
    console.log(`   Value: ${blob.url}`);
    console.log('   Environments: Production, Preview, Development');
    console.log('\n3. Redeploy or run ingestion');
    
    return blob;
  } catch (error) {
    console.error('[Upload] Error:', error);
    process.exit(1);
  }
}

uploadSocToBlob();
