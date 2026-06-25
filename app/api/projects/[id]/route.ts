export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const docRef = adminDb.collection('projects').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const p = docSnap.data() as any;

    const normalizeDate = (d: any): string | null => {
      if (!d) return null;
      if (typeof d.toDate === 'function') {
        return d.toDate().toISOString();
      }
      if (d.seconds !== undefined) {
        return new Date(d.seconds * 1000).toISOString();
      }
      if (typeof d === 'string') {
        return d;
      }
      const dateObj = new Date(d);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
      }
      return null;
    };

    const rawTimeline = p.timeline;
    const defaultMilestones = [
      { key: "smokeTesting", label: "Smoke Testing", order: 1 },
      { key: "testCaseWriting", label: "Test Case Writing", order: 2 },
      { key: "designValidation", label: "Design Validation", order: 3 },
      { key: "integrationTesting", label: "Integration Testing", order: 4 },
      { key: "regressionTesting", label: "Regression Testing", order: 5 },
      { key: "uatSupport", label: "UAT Support", order: 6 },
      { key: "releaseVerification", label: "Release Verification", order: 7 },
      { key: "postReleaseValidation", label: "Post Release Validation", order: 8 }
    ];

    const normalizedTimeline: any = {};
    if (rawTimeline !== undefined && rawTimeline !== null) {
      Object.entries(rawTimeline).forEach(([key, val]: [string, any]) => {
        const defaultMatch = defaultMilestones.find(dm => dm.key === key);
        normalizedTimeline[key] = {
          label: val.label || defaultMatch?.label || key,
          status: val.status || 'Not Started',
          owner: val.owner || '',
          plannedDate: val.plannedDate || null,
          completedDate: val.completedDate || null,
          notes: val.notes || '',
          order: val.order !== undefined ? val.order : (defaultMatch?.order !== undefined ? defaultMatch.order : 999)
        };
      });
    } else {
      defaultMilestones.forEach(dm => {
        normalizedTimeline[dm.key] = {
          label: dm.label,
          status: 'Not Started',
          owner: '',
          plannedDate: null,
          completedDate: null,
          notes: '',
          order: dm.order
        };
      });
    }

    const sortedTimelineList = Object.entries(normalizedTimeline)
      .map(([key, val]: [string, any]) => ({ key, ...val }))
      .sort((a, b) => a.order - b.order);

    const finalTimeline: any = {};
    sortedTimelineList.forEach((item, idx) => {
      finalTimeline[item.key] = {
        label: item.label,
        status: item.status,
        owner: item.owner,
        plannedDate: item.plannedDate,
        completedDate: item.completedDate,
        notes: item.notes,
        order: idx + 1
      };
    });

    return NextResponse.json({
      id: docSnap.id,
      code: p.code || '',
      name: p.name,
      tlName: p.tl_name,
      assigneeName: p.assignee_name,
      devName: p.dev_name,
      status: p.status ?? 'ACTIVE',
      description: p.description || '',
      scope: p.scope || '',
      requirements: p.requirements || '',
      startDate: normalizeDate(p.startDate),
      targetReleaseDate: normalizeDate(p.targetReleaseDate),
      primaryQaEmail: p.primaryQaEmail || '',
      primaryQaName: p.primaryQaName || '',
      supportingQaEmail: p.supportingQaEmail || '',
      supportingQaName: p.supportingQaName || '',
      teamLeadEmail: p.teamLeadEmail || '',
      teamLeadName: p.teamLeadName || '',
      developerEmails: p.developerEmails || [],
      developerNames: p.developerNames || [],
      documents: p.documents || [],
      timeline: finalTimeline,
      notesAndFlags: p.notesAndFlags || [],
      createdAt: normalizeDate(p.created_at),
      updated_at: normalizeDate(p.updated_at),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
