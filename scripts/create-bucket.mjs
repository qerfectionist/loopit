// One-time script to create the item-images storage bucket
// Run: node scripts/create-bucket.mjs
// Delete this file after use!

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://odaandtvfdsezmrcxqpc.supabase.co',
  process.env.SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const { data, error } = await supabase.storage.createBucket('item-images', {
  public: true,
  fileSizeLimit: 5242880,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
})

if (error) {
  console.error('❌ Failed:', error.message)
  process.exit(1)
}

console.log('✅ Bucket created:', data)
