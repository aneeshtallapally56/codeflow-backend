import fs from 'fs';
import { supabase } from '../../config/supabase';

export async function uploadToSupabase(zipPath: string, userId: string, projectId: string): Promise<string> {
  const buffer = fs.readFileSync(zipPath);
  const filePath = `${userId}/${projectId}.zip`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET_NAME!)
    .upload(filePath, buffer, {
      contentType: 'application/zip',
      upsert: true,
    });

  if (error) throw error;

  const { publicUrl } = supabase
    .storage
    .from(process.env.SUPABASE_BUCKET_NAME!)
    .getPublicUrl(filePath).data;

  return publicUrl;
}