/** Media: presigned direct-to-S3 uploads + completion verification (doc 04 §5). */
import { nanoid } from 'nanoid';
import { AppError, ErrorCode, MEDIA_RULES, type SignUploadResponse } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { presignUpload, headObject, publicUrlFor, deleteObject } from '../../lib/s3.js';

type MType = keyof typeof MEDIA_RULES;

export async function signUpload(
  type: MType,
  mimeType: string,
  sizeBytes: number,
  userId: string,
): Promise<SignUploadResponse> {
  const rules = MEDIA_RULES[type];
  if (!(rules.mimes as readonly string[]).includes(mimeType)) {
    throw new AppError(ErrorCode.UNSUPPORTED_MEDIA, `Unsupported ${type} type: ${mimeType}`);
  }
  if (sizeBytes > rules.maxBytes) {
    throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE, `Exceeds ${rules.maxBytes} bytes`);
  }

  const ext = mimeType.split('/')[1] ?? 'bin';
  const storageKey = `${type.toLowerCase()}/${nanoid(20)}.${ext}`;

  await prisma.mediaAsset.create({
    data: { id: nanoid(20), type, status: 'PENDING', storageKey, mimeType, sizeBytes, uploadedById: userId },
  });
  const asset = await prisma.mediaAsset.findUnique({ where: { storageKey }, select: { id: true } });

  return {
    mediaId: asset!.id,
    uploadUrl: await presignUpload(storageKey, mimeType),
    storageKey,
    publicUrl: publicUrlFor(storageKey),
  };
}

/** Client confirms upload finished → verify the object exists, mark READY. */
export async function completeUpload(mediaId: string): Promise<{ url: string }> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset) throw new AppError(ErrorCode.NOT_FOUND, 'Media not found');

  const head = await headObject(asset.storageKey).catch(() => null);
  if (!head) {
    await prisma.mediaAsset.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
    throw new AppError(ErrorCode.CONFLICT, 'Upload not found in storage');
  }

  const url = publicUrlFor(asset.storageKey);
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: { status: 'READY', url, sizeBytes: head.sizeBytes ?? asset.sizeBytes },
  });
  return { url };
}

export function listMedia(cursor: string | undefined, limit: number) {
  return prisma.mediaAsset.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset) return;
  await deleteObject(asset.storageKey).catch(() => {});
  await prisma.mediaAsset.delete({ where: { id: mediaId } });
}
