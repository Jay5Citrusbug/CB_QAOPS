import { adminStorage } from './firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Uploads a file buffer to Firebase Storage, falling back to local filesystem if credentials
 * are not configured or the upload fails.
 * 
 * @param buffer File buffer to upload
 * @param fileName Original file name
 * @param mimeType MIME type of the file
 * @param subFolder Subfolder under uploads/ (e.g. 'my-drive', 'notes', 'qa-docs', etc.)
 * @returns Object with the uploaded file URL
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  subFolder: string
): Promise<{ url: string; isFirebase: boolean }> {
  const isVercel = !!process.env.VERCEL;
  const hasFirebaseCreds = process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_PROJECT_ID.includes('mock');

  if (hasFirebaseCreds) {
    try {
      const bucket = adminStorage.bucket();
      const sanitizedBase = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${Date.now()}_${sanitizedBase}`;
      const destination = `uploads/${subFolder}/${uniqueFileName}`;
      
      const fileRef = bucket.file(destination);
      await fileRef.save(buffer, {
        metadata: {
          contentType: mimeType || 'application/octet-stream',
        },
      });
      
      // Get signed URL with far-future expiry
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-09-2491', // far-future expiry
      });
      
      return { url, isFirebase: true };
    } catch (error: any) {
      console.error('[Firebase Storage Upload Error] Falling back to local disk:', error);
      if (isVercel) {
        throw new Error(`Failed to upload file to Firebase Storage on Vercel: ${error.message}`);
      }
    }
  }

  // Local filesystem fallback
  const sanitizedBase = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueFileName = `${Date.now()}_${sanitizedBase}`;
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', subFolder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const filePath = path.join(uploadDir, uniqueFileName);
  fs.writeFileSync(filePath, buffer);
  
  const relativeUrl = `/uploads/${subFolder}/${encodeURIComponent(uniqueFileName)}`;
  return { url: relativeUrl, isFirebase: false };
}

/**
 * Deletes a file from Firebase Storage or local filesystem based on its URL format.
 * 
 * @param fileUrl URL of the file to delete
 * @returns Promise<boolean> indicating success
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  if (!fileUrl) return false;

  try {
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      const urlObj = new URL(fileUrl);
      const bucket = adminStorage.bucket();
      let objectPath = '';

      if (urlObj.hostname === 'firebasestorage.googleapis.com') {
        const parts = urlObj.pathname.split('/o/');
        if (parts.length > 1) {
          objectPath = decodeURIComponent(parts[1]);
        }
      } else {
        let decodedPath = decodeURIComponent(urlObj.pathname).replace(/^\//, '');
        if (decodedPath.startsWith(bucket.name + '/')) {
          objectPath = decodedPath.slice(bucket.name.length + 1);
        } else {
          objectPath = decodedPath;
        }
      }

      if (objectPath) {
        const fileRef = bucket.file(objectPath);
        const [exists] = await fileRef.exists();
        if (exists) {
          await fileRef.delete();
          return true;
        }
      }
      return false;
    } else {
      // Local filesystem path
      const decodedPath = decodeURIComponent(fileUrl);
      const relativeDiskPath = decodedPath.replace(/^\//, ''); // strip leading slash
      const fullDiskPath = path.join(process.cwd(), 'public', relativeDiskPath);

      if (fs.existsSync(fullDiskPath)) {
        fs.unlinkSync(fullDiskPath);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('[Delete File Error]:', error);
    return false;
  }
}
