/** S3-compatible storage client + presigned upload helper. */
import { S3Client, HeadObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export function publicUrlFor(storageKey: string): string {
  return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`;
}

/** Presigned PUT URL for direct browser→S3 upload (keeps large media off the API). */
export async function presignUpload(
  storageKey: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

/** Verify an object exists and read its size/type (post-upload completion check). */
export async function headObject(storageKey: string) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
  return { sizeBytes: res.ContentLength ?? null, mimeType: res.ContentType ?? null };
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }));
}
