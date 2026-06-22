export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { uploadFile, deleteFile } from '@/lib/upload-helper';

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
    const linkUrl = formData.get('linkUrl') as string | null;
    const linkName = formData.get('linkName') as string | null;
    const category = (formData.get('category') as string) || 'Other';
    const replaceDocId = formData.get('replaceDocId') as string | null;

    // Fetch user profile for logging
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'Unknown User';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const projSnap = await projectRef.get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projData = projSnap.data() || {};
    let docs = projData.documents || [];

    const newDocId = replaceDocId || `doc_${Date.now()}`;
    let newDocObj: any;

    if (linkUrl) {
      const name = linkName || linkUrl;
      const url = linkUrl;

      newDocObj = {
        id: newDocId,
        name,
        category,
        url,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
        isLink: true,
      };

      if (replaceDocId) {
        // Find old document to delete its file from storage if it was a file
        const oldDoc = docs.find((d: any) => d.id === replaceDocId);
        if (oldDoc && !oldDoc.isLink && oldDoc.url) {
          await deleteFile(oldDoc.url);
        }
        docs = docs.map((d: any) => (d.id === replaceDocId ? newDocObj : d));
      } else {
        docs.push(newDocObj);
      }
    } else {
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'No file or link URL provided' }, { status: 400 });
      }

      const name = (file as any).name || 'document';
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url: fileUrl } = await uploadFile(buffer, name, file.type, `projects/${projectId}`);

      newDocObj = {
        id: newDocId,
        name,
        category,
        url: fileUrl,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
      };

      if (replaceDocId) {
        // Find old document to delete its file from storage if it was a file
        const oldDoc = docs.find((d: any) => d.id === replaceDocId);
        if (oldDoc && !oldDoc.isLink && oldDoc.url) {
          await deleteFile(oldDoc.url);
        }
        docs = docs.map((d: any) => (d.id === replaceDocId ? newDocObj : d));
      } else {
        docs.push(newDocObj);
      }
    }

    await projectRef.update({ documents: docs });

    // Log audit log
    await adminDb.collection('audit_logs').add({
      user: userName,
      action: replaceDocId ? (linkUrl ? 'Document Link Replaced' : 'Document Replaced') : (linkUrl ? 'Document Link Added' : 'Document Uploaded'),
      project_id: projectId,
      timestamp: new Date(),
      details: {
        docId: newDocId,
        fileName: newDocObj.name,
        category,
        isLink: !!linkUrl,
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

    // Delete from storage if it's not a link
    if (!targetDoc.isLink && targetDoc.url) {
      await deleteFile(targetDoc.url);
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
      action: targetDoc.isLink ? 'Document Link Deleted' : 'Document Deleted',
      project_id: projectId,
      timestamp: new Date(),
      details: {
        docId,
        fileName: targetDoc.name,
        isLink: !!targetDoc.isLink,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
