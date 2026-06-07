import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;
    const category = (formData.get('category') as string) || 'Other';
    const replaceDocId = formData.get('replaceDocId') as string | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const name = (file as any).name || 'document';
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create target folder in public uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(uploadDir, name);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/projects/${projectId}/${encodeURIComponent(name)}`;

    // Fetch user profile for logging
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'Unknown User';

    // Update project document list
    const projectRef = adminDb.collection('projects').doc(projectId);
    const projSnap = await projectRef.get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projData = projSnap.data() || {};
    let docs = projData.documents || [];

    const newDocId = replaceDocId || `doc_${Date.now()}`;
    const newDocObj = {
      id: newDocId,
      name,
      category,
      url: relativeUrl,
      uploadedBy: userName,
      uploadedAt: new Date().toISOString(),
    };

    if (replaceDocId) {
      // Find old document to delete its file from disk if path exists
      const oldDoc = docs.find((d: any) => d.id === replaceDocId);
      if (oldDoc) {
        try {
          const oldName = oldDoc.name;
          const oldFilePath = path.join(uploadDir, oldName);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (err) {
          console.error('Failed to delete old file from disk:', err);
        }
      }
      docs = docs.map((d: any) => (d.id === replaceDocId ? newDocObj : d));
    } else {
      docs.push(newDocObj);
    }

    await projectRef.update({ documents: docs });

    // Log audit log
    await adminDb.collection('audit_logs').add({
      user: userName,
      action: replaceDocId ? 'Document Replaced' : 'Document Uploaded',
      project_id: projectId,
      timestamp: new Date(),
      details: {
        docId: newDocId,
        fileName: name,
        category,
      },
    });

    return NextResponse.json({ success: true, document: newDocObj });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('docId');

    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    const projectRef = adminDb.collection('projects').doc(projectId);
    const projSnap = await projectRef.get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projData = projSnap.data() || {};
    const docs = projData.documents || [];

    const targetDoc = docs.find((d: any) => d.id === docId);
    if (!targetDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from disk
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId, targetDoc.name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to delete file from disk:', err);
    }

    // Remove from array
    const updatedDocs = docs.filter((d: any) => d.id !== docId);
    await projectRef.update({ documents: updatedDocs });

    // Fetch user profile for logging
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'Unknown User';

    // Log audit log
    await adminDb.collection('audit_logs').add({
      user: userName,
      action: 'Document Deleted',
      project_id: projectId,
      timestamp: new Date(),
      details: {
        docId,
        fileName: targetDoc.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
