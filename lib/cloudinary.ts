import crypto from 'crypto';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/**
 * Helper to sign parameters for secure Cloudinary API requests.
 */
export function signParameters(params: Record<string, any>): string {
  if (!apiSecret) throw new Error('Cloudinary API secret is not configured.');
  
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&') + apiSecret;
  
  return crypto.createHash('sha1').update(signString).digest('hex');
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format?: string;
  bytes?: number;
  resource_type: string;
  [key: string]: any;
}

/**
 * Uploads a file buffer to Cloudinary using standard fetch and signature authentication.
 * 
 * @param buffer File buffer to upload
 * @param fileName Original file name
 * @param mimeType MIME type of the file
 * @param folder Cloudinary folder path
 * @returns Upload result metadata from Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<CloudinaryUploadResult> {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials are not configured in environment variables.');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const publicId = `${Date.now()}_${sanitizedName}`;
  const resourceType = mimeType.startsWith('image/') ? 'image' : 'raw';

  const params: Record<string, string> = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const signature = signParameters(params);

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Deletes an asset from Cloudinary using public_id.
 * 
 * @param publicId Cloudinary public_id of the asset
 * @param resourceType Resource type of the asset ('image', 'raw', 'video')
 * @returns Result status from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<{ result: string; [key: string]: any }> {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials are not configured.');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const params: Record<string, string> = {
    public_id: publicId,
    timestamp,
  };

  const signature = signParameters(params);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary delete failed: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// Export a default object matching the requested Cloudinary client structure
const cloudinaryClient = {
  uploader: {
    upload: async (file: string, options: any = {}) => {
      throw new Error('Use direct uploadToCloudinary helper instead.');
    }
  }
};

export default cloudinaryClient;
