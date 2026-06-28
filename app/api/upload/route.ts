import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse the uploaded file from FormData
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = (file as any).name || 'uploaded_file';
    const mimeType = file.type || 'application/octet-stream';

    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty files are not allowed' }, { status: 400 });
    }

    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum 25MB limit' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const folder = 'cb-qops-uploads';
    const uploadResult = await uploadToCloudinary(buffer, fileName, mimeType, folder);

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format || fileName.split('.').pop() || '',
      bytes: uploadResult.bytes || file.size,
      uploadedBy: session.user.email,
    });
  } catch (error: any) {
    console.error('[Cloudinary Upload Route POST] Failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload file to Cloudinary' }, { status: 500 });
  }
}
