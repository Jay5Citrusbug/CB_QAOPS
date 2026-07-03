export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// GET: Retrieve all QA folders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.collection('qa_folders').get();
    const folders = snapshot.docs.map(doc => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        name: d.name,
        created_by: d.created_by || 'System',
        created_at: d.created_at ? (typeof d.created_at.toDate === 'function' ? d.created_at.toDate().toISOString() : new Date(d.created_at).toISOString()) : null,
      };
    });

    // Sort folders alphabetically by name
    folders.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(folders);
  } catch (error: any) {
    console.error('[QA Folders GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new QA folder (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check for duplicate name
    const dupeCheck = await adminDb.collection('qa_folders').where('name', '==', trimmedName).get();
    if (!dupeCheck.empty) {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 400 });
    }

    const newFolderObj = {
      name: trimmedName,
      created_by: session.user.name || session.user.email || 'Admin',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('qa_folders').add(newFolderObj);

    return NextResponse.json({ success: true, id: docRef.id, name: trimmedName });
  } catch (error: any) {
    console.error('[QA Folders POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a folder and all its documents (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const folderId = searchParams.get('id');

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Verify folder exists
    const folderDoc = await adminDb.collection('qa_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Find all files/links under this folder and delete them
    const docsSnapshot = await adminDb.collection('qa_docs').where('folder_id', '==', folderId).get();
    
    // Batch Firestore writes
    const batch = adminDb.batch();

    // Clean up files from disk
    for (const doc of docsSnapshot.docs) {
      const itemData = doc.data() as any;
      if (itemData.type === 'file' && itemData.url) {
        try {
          const decodedPath = decodeURIComponent(itemData.url);
          const relativeDiskPath = decodedPath.replace(/^\//, ''); // strip leading slash
          const fullDiskPath = path.join(process.cwd(), 'public', relativeDiskPath);
          
          if (fs.existsSync(fullDiskPath)) {
            fs.unlinkSync(fullDiskPath);
          }
        } catch (err) {
          console.error('[QA Folders DELETE] Failed to delete physical file:', err);
        }
      }
      // Delete document record
      batch.delete(doc.ref);
    }

    // Delete folder record
    batch.delete(adminDb.collection('qa_folders').doc(folderId));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[QA Folders DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Rename a QA folder (Admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Verify folder exists
    const folderDoc = await adminDb.collection('qa_folders').doc(id).get();
    if (!folderDoc.exists) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check for duplicate name (excluding itself)
    const dupeCheck = await adminDb.collection('qa_folders').where('name', '==', trimmedName).get();
    const otherDupe = dupeCheck.docs.some(doc => doc.id !== id);
    if (otherDupe) {
      return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 400 });
    }

    // Update folder name
    await adminDb.collection('qa_folders').doc(id).update({
      name: trimmedName,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id, name: trimmedName });
  } catch (error: any) {
    console.error('[QA Folders PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
