export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { uploadFile, deleteFile } from '@/lib/upload-helper';

// GET: Retrieve all docs inside a folder
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Query documents where folder_id == folderId
    const snapshot = await adminDb.collection('qa_docs').where('folder_id', '==', folderId).get();
    const docs = snapshot.docs.map(doc => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        folderId: d.folder_id,
        name: d.name,
        url: d.url,
        type: d.type, // 'file' | 'link'
        uploadedBy: d.uploaded_by || 'Admin',
        uploadedAt: d.uploaded_at ? (typeof d.uploaded_at.toDate === 'function' ? d.uploaded_at.toDate().toISOString() : new Date(d.uploaded_at).toISOString()) : null,
        fileSize: d.file_size || null,
        fileExt: d.file_ext || null,
      };
    });

    // Sort documents by uploadedAt descending (newest first)
    docs.sort((a, b) => {
      const tA = a.uploadedAt || '';
      const tB = b.uploadedAt || '';
      return tB.localeCompare(tA);
    });

    return NextResponse.json(docs);
  } catch (error: any) {
    console.error('[QA Docs GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Upload file or save link to folder (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const folderId = formData.get('folderId') as string | null;
    const file = formData.get('file') as Blob | null;
    const linkUrl = formData.get('linkUrl') as string | null;
    const linkName = formData.get('linkName') as string | null;

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Verify folder exists
    const folderDoc = await adminDb.collection('qa_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const userName = session.user.name || session.user.email || 'Admin';
    let newDocObj: any;

    if (linkUrl) {
      const name = linkName || linkUrl;
      newDocObj = {
        folder_id: folderId,
        name: name.trim(),
        url: linkUrl.trim(),
        type: 'link',
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
      const { url: fileUrl } = await uploadFile(buffer, name, file.type, 'qa-docs');
      const ext = name.split('.').pop()?.toLowerCase() || '';

      newDocObj = {
        folder_id: folderId,
        name,
        url: fileUrl,
        type: 'file',
        file_size: file.size,
        file_ext: ext,
        uploaded_by: userName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    const docRef = await adminDb.collection('qa_docs').add(newDocObj);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('[QA Docs POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove file or link from folder (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const docRef = adminDb.collection('qa_docs').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const itemData = docSnap.data() as any;

    // If it's a file, remove it from storage
    if (itemData.type === 'file' && itemData.url) {
      await deleteFile(itemData.url);
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[QA Docs DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
