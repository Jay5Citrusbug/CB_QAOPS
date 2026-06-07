export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

const DEFAULT_MILESTONES = [
  { id: "smokeTesting", label: "Smoke Testing", order: 1 },
  { id: "testCaseWriting", label: "Test Case Writing", order: 2 },
  { id: "designValidation", label: "Design Validation", order: 3 },
  { id: "integrationTesting", label: "Integration Testing", order: 4 },
  { id: "regressionTesting", label: "Regression Testing", order: 5 },
  { id: "uatSupport", label: "UAT Support", order: 6 },
  { id: "releaseVerification", label: "Release Verification", order: 7 },
  { id: "postReleaseValidation", label: "Post Release Validation", order: 8 }
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.collection('milestones').orderBy('order', 'asc').get();
    if (snapshot.empty) {
      // Seed default milestones
      const batch = adminDb.batch();
      for (const m of DEFAULT_MILESTONES) {
        const docRef = adminDb.collection('milestones').doc(m.id);
        batch.set(docRef, { label: m.label, order: m.order });
      }
      await batch.commit();
      return NextResponse.json(DEFAULT_MILESTONES);
    }

    const milestones = snapshot.docs.map(doc => ({
      id: doc.id,
      label: doc.data().label || '',
      order: doc.data().order || 0,
    }));

    return NextResponse.json(milestones);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN' && role !== 'TL') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { label } = body;
      if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });
      
      // Generate safe key/id
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      if (!id) return NextResponse.json({ error: 'Invalid label' }, { status: 400 });

      // Check if it already exists
      const docRef = adminDb.collection('milestones').doc(id);
      const doc = await docRef.get();
      if (doc.exists) {
        return NextResponse.json({ error: 'Milestone key already exists' }, { status: 400 });
      }

      // Find highest order
      const snapshot = await adminDb.collection('milestones').orderBy('order', 'desc').limit(1).get();
      let nextOrder = 1;
      if (!snapshot.empty) {
        nextOrder = (snapshot.docs[0].data().order || 0) + 1;
      }

      await docRef.set({ label, order: nextOrder });
      return NextResponse.json({ success: true, id, label, order: nextOrder });
    }

    if (action === 'update') {
      const { id, label } = body;
      if (!id || !label) return NextResponse.json({ error: 'ID and Label are required' }, { status: 400 });

      await adminDb.collection('milestones').doc(id).update({ label });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

      await adminDb.collection('milestones').doc(id).delete();
      return NextResponse.json({ success: true });
    }

    if (action === 'reorder') {
      const { orders } = body; // Array of { id, order }
      if (!Array.isArray(orders)) return NextResponse.json({ error: 'Orders array is required' }, { status: 400 });

      const batch = adminDb.batch();
      for (const item of orders) {
        const docRef = adminDb.collection('milestones').doc(item.id);
        batch.update(docRef, { order: item.order });
      }
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
