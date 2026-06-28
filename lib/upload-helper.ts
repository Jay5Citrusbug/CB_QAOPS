import { adminStorage } from './firebase-admin';
import fs from 'fs';
import path from 'path';
import { uploadToCloudinary, deleteFromCloudinary } from './cloudinary';

/**
 * Uploads a file buffer to Cloudinary, falling back to Firebase Storage if Cloudinary configuration fails.
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
  try {
    const folder = `cb-qops/${subFolder}`;
    const result = await uploadToCloudinary(buffer, fileName, mimeType, folder);
    
    console.log(`[Cloudinary Upload Success]: ${result.secure_url}`);
    return { url: result.secure_url, isFirebase: false };
  } catch (cloudinaryError: any) {
    console.error('[Cloudinary Upload Error] Falling back to Firebase Storage/Disk:', cloudinaryError);
    
    // Cloudinary failure fallback to Firebase Storage
    const hasFirebaseCreds = process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_PROJECT_ID.includes('mock');
    const isVercel = !!process.env.VERCEL;

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
        
        const [url] = await fileRef.getSignedUrl({
          action: 'read',
          expires: '03-09-2491',
        });
        
        return { url, isFirebase: true };
      } catch (error: any) {
        console.error('[Firebase Storage Upload Error] Falling back to local disk:', error);
        if (isVercel) {
          throw new Error(`Failed to upload file to Firebase Storage on Vercel: ${error.message}`);
        }
      }
    }

    // Local disk fallback
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
}

/**
 * Deletes a file from Cloudinary, Firebase Storage, or local filesystem based on its URL format.
 * 
 * @param fileUrl URL of the file to delete
 * @returns Promise<boolean> indicating success
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  if (!fileUrl) return false;

  try {
    // 1. Cloudinary Url check
    if (fileUrl.includes('res.cloudinary.com')) {
      const uploadIndex = fileUrl.indexOf('/upload/');
      if (uploadIndex !== -1) {
        const afterUpload = fileUrl.substring(uploadIndex + 8);
        const nextSlash = afterUpload.indexOf('/');
        let pathAndName = afterUpload;
        
        if (afterUpload.startsWith('v')) {
          const versionSegment = afterUpload.substring(0, nextSlash);
          if (/^v\d+$/.test(versionSegment)) {
            pathAndName = afterUpload.substring(nextSlash + 1);
          }
        }
        
        const isRaw = fileUrl.includes('/raw/upload/');
        const isVideo = fileUrl.includes('/video/upload/');
        const resourceType = isRaw ? 'raw' : (isVideo ? 'video' : 'image');

        let publicId = pathAndName;
        if (resourceType !== 'raw') {
          const lastDot = pathAndName.lastIndexOf('.');
          if (lastDot !== -1) {
            publicId = pathAndName.substring(0, lastDot);
          }
        }
        
        publicId = decodeURIComponent(publicId);
        
        console.log(`[Cloudinary Deleting] Public ID: ${publicId}, Type: ${resourceType}`);
        await deleteFromCloudinary(publicId, resourceType);
        return true;
      }
    }

    // 2. Firebase URL fallback
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
      // 3. Local filesystem path fallback
      const decodedPath = decodeURIComponent(fileUrl);
      const relativeDiskPath = decodedPath.replace(/^\//, '');
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
