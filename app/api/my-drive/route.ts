export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// GET: Retrieve user-specific private drive items and all public items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Fetch all items from my_drive collection
    const snapshot = await adminDb.collection('my_drive').get();
    const items = snapshot.docs.map(doc => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        name: d.name,
        url: d.url,
        type: d.type, // 'file' | 'link'
        category: d.category || 'private', // 'private' | 'public'
        userId: d.user_id,
        uploadedBy: d.uploaded_by,
        uploadedAt: d.uploaded_at ? (typeof d.uploaded_at.toDate === 'function' ? d.uploaded_at.toDate().toISOString() : new Date(d.uploaded_at).toISOString()) : null,
        fileSize: d.file_size || null,
        fileExt: d.file_ext || null,
      };
    });

    // Filter items: category === 'public' OR (category === 'private' and uploaded by current user)
    const filteredItems = items.filter(item => 
      item.category === 'public' || item.userId === userId
    );

    // Sort by uploaded time descending
    filteredItems.sort((a, b) => {
      const tA = a.uploadedAt || '';
      const tB = b.uploadedAt || '';
      return tB.localeCompare(tA);
    });

    return NextResponse.json(filteredItems);
  } catch (error: any) {
    console.error('[My Drive GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add file or link to drive
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    
    // Fetch user profile name
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'Unknown User';

    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;
    const linkUrl = formData.get('linkUrl') as string | null;
    const linkName = formData.get('linkName') as string | null;
    const category = (formData.get('category') as string) || 'private'; // 'private' | 'public'

    if (category !== 'private' && category !== 'public') {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    let newDriveObj: any;

    if (linkUrl) {
      const name = linkName || linkUrl;
      newDriveObj = {
        name,
        url: linkUrl.trim(),
        type: 'link',
        category,
        user_id: userId,
        uploaded_by: userName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
      };
    } else {
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'No file or link URL provided' }, { status: 400 });
      }

      const name = (file as any).name || 'file';
      const buffer = Buffer.from(await file.arrayBuffer());

      // Create target directory: public/uploads/my-drive
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'my-drive');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Unique file name to prevent collision
      const uniqueFileName = `${Date.now()}_${name}`;
      const filePath = path.join(uploadDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/uploads/my-drive/${encodeURIComponent(uniqueFileName)}`;
      const ext = name.split('.').pop()?.toLowerCase() || '';

      newDriveObj = {
        name,
        url: relativeUrl,
        type: 'file',
        category,
        user_id: userId,
        uploaded_by: userName,
        file_size: file.size,
        file_ext: ext,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    const docRef = await adminDb.collection('my_drive').add(newDriveObj);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('[My Drive POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a file/link from the drive (only the uploader can delete their own upload)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const docRef = adminDb.collection('my_drive').doc(itemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const itemData = doc.data() as any;

    // Check ownership: only uploader or ADMIN can delete
    const userRole = (session.user as any).role || 'USER';
    if (itemData.user_id !== userId && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If it's a file, remove it from disk
    if (itemData.type === 'file' && itemData.url) {
      try {
        const decodedPath = decodeURIComponent(itemData.url);
        const relativeDiskPath = decodedPath.replace(/^\//, ''); // strip leading slash
        const fullDiskPath = path.join(process.cwd(), 'public', relativeDiskPath);
        
        if (fs.existsSync(fullDiskPath)) {
          fs.unlinkSync(fullDiskPath);
        }
      } catch (err) {
        console.error('Failed to delete physical file:', err);
      }
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[My Drive DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
