// B4: shrink an oversized photo/scan in the browser (canvas re-encode to JPEG) so the
// user doesn't have to resize phone photos by hand. Returns null when it can't (no
// canvas support, decode failure, PDF) and the caller falls back to the normal error.
import { compressImage, MAX_IMAGE_BYTES } from '../core/image';

export async function compressFile(file: File): Promise<File | null> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const result = await compressImage((quality, scale) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return Promise.reject(new Error('no 2d context'));
      }
      ctx.fillStyle = '#ffffff'; // JPEG has no alpha - avoid black backgrounds on PNGs
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
      );
    }, MAX_IMAGE_BYTES);
    if (!result.withinLimit) {
      return null;
    }
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([result.blob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}
