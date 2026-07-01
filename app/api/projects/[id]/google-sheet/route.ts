export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import {
  extractSpreadsheetId,
  getGoogleAuthToken,
  getSpreadsheetSheets,
  getSheetValues,
  findHeaderIndex,
} from "@/lib/google-sheets";

function hasProjectAccess(session: any, projectId: string): boolean {
  if (!session?.user) return false;
  const { role, projectId: userProjectId } = session.user;
  if (role === "ADMIN") return true;
  if (role === "DEV" || role === "TL") {
    return userProjectId === projectId;
  }
  return true;
}

const REQUIRED_COLUMNS = [
  "Test Case ID",
  "Module",
  "Test Case Title",
  "Pre-Conditions",
  "Test Steps",
  "Test Data",
  "Expected Result",
  "Dev Status",
  "Dev Date Executed",
  "Dev Notes",
  "QA Status",
  "cross browser Verfied ?",
  "Priority",
  "JIRA Ticket",
];

// Helper to log audit activities
async function logAudit(projectId: string, user: string, action: string) {
  try {
    await adminDb.collection("projects").doc(projectId).collection("audit_logs").add({
      user,
      action,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

/**
 * GET connection status, history and audit logs
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docRef = adminDb.collection("projects").doc(projectId);

    // Fetch project doc, sync history, and audit logs in parallel!
    const [doc, syncHistorySnap, auditLogsSnap] = await Promise.all([
      docRef.get(),
      docRef.collection("sync_history").orderBy("syncTime", "desc").limit(50).get(),
      docRef.collection("audit_logs").orderBy("timestamp", "desc").limit(50).get()
    ]);

    if (!doc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = doc.data() as any;
    const googleSheet = projectData.googleSheet || null;

    const syncHistory = syncHistorySnap.docs.map(d => {
      const data = d.data();
      const syncTimeVal = data.syncTime;
      const syncTimeStr = (syncTimeVal && typeof (syncTimeVal as any).toDate === 'function')
        ? (syncTimeVal as admin.firestore.Timestamp).toDate().toISOString()
        : (syncTimeVal && typeof syncTimeVal === 'string' && !isNaN(Date.parse(syncTimeVal)))
          ? new Date(syncTimeVal).toISOString()
          : null;
      return {
        id: d.id,
        ...data,
        syncTime: syncTimeStr,
      };
    });

    const auditLogs = auditLogsSnap.docs.map(d => {
      const data = d.data();
      const tsVal = data.timestamp;
      const tsStr = (tsVal && typeof (tsVal as any).toDate === 'function')
        ? (tsVal as admin.firestore.Timestamp).toDate().toISOString()
        : (tsVal && typeof tsVal === 'string' && !isNaN(Date.parse(tsVal)))
          ? new Date(tsVal).toISOString()
          : null;
      return {
        id: d.id,
        ...data,
        timestamp: tsStr,
      };
    });

    return NextResponse.json({
      connected: !!(googleSheet && googleSheet.url),
      config: googleSheet && googleSheet.url ? googleSheet : null,
      syncHistory,
      auditLogs,
    });
  } catch (error: any) {
    const errMsg: string = error.message || "";
    // Detect Firestore quota exhaustion — signal client so it does NOT disconnect
    const isQuotaError =
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("Quota exceeded") ||
      errMsg.includes("quota");

    return NextResponse.json(
      {
        error: errMsg,
        isQuotaError,
        // Return empty arrays so destructuring is safe
        syncHistory: [],
        auditLogs: [],
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
}

/**
 * POST connection request (validate URL or perform actual import)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";
    const body = await req.json();
    const { url, action } = body; // action = 'validate' | 'import'

    if (!url) {
      return NextResponse.json({ error: "Invalid Google Sheet URL" }, { status: 400 });
    }

    const spreadsheetId = extractSpreadsheetId(url);
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Invalid Google Sheet URL" }, { status: 400 });
    }

    // Authenticate and get sheet values
    let accessToken: string;
    try {
      accessToken = await getGoogleAuthToken();
    } catch (err: any) {
      return NextResponse.json({ error: "Unable to access Google Sheet" }, { status: 500 });
    }

    let sheets: string[];
    try {
      sheets = await getSpreadsheetSheets(spreadsheetId, accessToken);
    } catch (err: any) {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@cbqaops.iam.gserviceaccount.com";
      if (err.message === "API_DISABLED") {
        return NextResponse.json({
          error: `Google Sheets API is not enabled in your Google Cloud Console project.\n\nPlease enable it by visiting:\nhttps://console.cloud.google.com/apis/library/sheets.googleapis.com\n\nAfter enabling, wait 2 minutes and click "Connect" button again.`
        }, { status: 400 });
      }
      if (err.message === "PERMISSION_DENIED") {
        return NextResponse.json({
          error: `Please share this sheet with: ${clientEmail}\n\nPermission required: Editor\n\nAfter granting access, click "Connect" button again.`
        }, { status: 400 });
      }
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({
          error: `Google Sheet Not Found. Please verify that the spreadsheet URL "${url}" is correct and the sheet exists.`
        }, { status: 400 });
      }
      return NextResponse.json({ error: err.message || "Unable to access Google Sheet" }, { status: 400 });
    }

    if (sheets.length === 0) {
      return NextResponse.json({ error: "Sheet Contains Invalid Structure" }, { status: 400 });
    }

    const firstSheetName = sheets[0];
    let rawRows: string[][];
    try {
      rawRows = await getSheetValues(spreadsheetId, firstSheetName, accessToken);
    } catch (err: any) {
      return NextResponse.json({ error: "Unable to access Google Sheet" }, { status: 400 });
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Sheet Contains Invalid Structure" }, { status: 400 });
    }

    const headers = rawRows[0];
    const allHeaderIndexes = headers.reduce((acc, col, idx) => {
      acc[col] = idx;
      return acc;
    }, {} as Record<string, number>);

    let tcIdColIndex = findHeaderIndex(headers, "Test Case ID");
    if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "ID");
    if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "TC ID");

    let titleColIndex = findHeaderIndex(headers, "Test Case Title");
    if (titleColIndex === -1) titleColIndex = findHeaderIndex(headers, "Title");
    if (titleColIndex === -1) titleColIndex = findHeaderIndex(headers, "Test Case Name");

    const tcIdColName = tcIdColIndex !== -1 ? headers[tcIdColIndex] : null;
    const titleColName = titleColIndex !== -1 ? headers[titleColIndex] : null;

    // Validate rows (relaxed: auto-generate missing IDs/Titles, never reject rows)
    const testCases: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const idsSeen = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      
      // Skip completely empty rows
      const isRowEmpty = row.every(cell => !cell || cell.trim() === "");
      if (isRowEmpty) {
        continue;
      }

      let testCaseId = (tcIdColName ? row[allHeaderIndexes[tcIdColName]] || "" : "").trim();
      if (!testCaseId) {
        testCaseId = `TC-ROW-${i + 1}`;
      }
      
      let finalId = testCaseId;
      let suffix = 1;
      while (idsSeen.has(finalId)) {
        finalId = `${testCaseId}-${suffix++}`;
      }
      idsSeen.add(finalId);

      let title = (titleColName ? row[allHeaderIndexes[titleColName]] || "" : "").trim();
      if (!title) {
        title = `Test Case Row ${i + 1}`;
      }

      validCount++;

      // Construct the test case object dynamically with all sheet columns!
      const tcData: Record<string, any> = {};
      headers.forEach(col => {
        tcData[col] = row[allHeaderIndexes[col]] || "";
      });

      // Force-set fallback properties on the raw data so sync knows about them
      if (tcIdColName) {
        tcData[tcIdColName] = finalId;
      }
      if (titleColName) {
        tcData[titleColName] = title;
      }

      tcData.testCaseId = finalId;
      tcData.title = title;

      testCases.push(tcData);
    }

    if (action === "validate") {
      return NextResponse.json({
        success: true,
        preview: {
          sheetName: firstSheetName,
          headers: headers,
          totalRows: rawRows.length - 1,
          validRows: validCount,
          invalidRows: invalidCount,
          errors: errors.slice(0, 50),
          warnings: warnings,
        },
      });
    }

    if (action === "import") {
      if (validCount === 0) {
        return NextResponse.json({ error: "No valid rows found to import." }, { status: 400 });
      }

      await logAudit(projectId, userEmail, "Import Started");

      // Write test cases in batch
      const projectRef = adminDb.collection("projects").doc(projectId);
      const testCasesCollection = projectRef.collection("test_cases");

      // Create chunks of 500 for Firestore batch size limit
      const chunkSize = 500;
      const commitPromises: Promise<any>[] = [];

      for (let i = 0; i < testCases.length; i += chunkSize) {
        const chunk = testCases.slice(i, i + chunkSize);
        const batch = adminDb.batch();

        chunk.forEach(tc => {
          const devStatusCol = headers[findHeaderIndex(headers, "Dev Status")];
          const devDateCol = headers[findHeaderIndex(headers, "Dev Date Executed")];
          const devNotesCol = headers[findHeaderIndex(headers, "Dev Notes")];
          const qaStatusCol = headers[findHeaderIndex(headers, "QA Status")];
          const cbVerifiedCol = headers[findHeaderIndex(headers, "cross browser Verfied ?")];
          const priorityCol = headers[findHeaderIndex(headers, "Priority")];
          const jiraCol = headers[findHeaderIndex(headers, "JIRA Ticket")];
          const moduleCol = headers[findHeaderIndex(headers, "Module")];
          const tcIdCol = tcIdColName;
          const titleCol = titleColName;

          const finalTcId = (tcIdCol && tc[tcIdCol]) ? tc[tcIdCol] : (tc.testCaseId || `TC-ROW-${i}`);
          const docRef = testCasesCollection.doc(finalTcId);
          const finalTitle = (titleCol && tc[titleCol]) ? tc[titleCol] : (tc.title || "Unnamed Test Case");
          
          // Map to standard fields
          const docData = {
            ...tc, // Keep all dynamic raw column properties!
            testCaseId: finalTcId,
            module: moduleCol ? tc[moduleCol] || "" : "",
            title: finalTitle,
            preConditions: tc[headers[findHeaderIndex(headers, "Pre-Conditions")]] || "",
            testSteps: tc[headers[findHeaderIndex(headers, "Test Steps")]] || "",
            testData: tc[headers[findHeaderIndex(headers, "Test Data")]] || "",
            expectedResult: tc[headers[findHeaderIndex(headers, "Expected Result")]] || "",
            devStatus: devStatusCol ? tc[devStatusCol] || "Not Started" : "Not Started",
            devDateExecuted: devDateCol ? tc[devDateCol] || "" : "",
            devNotes: devNotesCol ? tc[devNotesCol] || "" : "",
            qaStatus: qaStatusCol ? tc[qaStatusCol] || "Not Run" : "Not Run",
            crossBrowserVerified: cbVerifiedCol ? tc[cbVerifiedCol] || "No" : "No",
            priority: priorityCol ? tc[priorityCol] || "Medium" : "Medium",
            jiraTicket: jiraCol ? tc[jiraCol] || "" : "",
            status: "active",
            lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSyncedValues: tc,
          };
          batch.set(docRef, docData);
        });

        commitPromises.push(batch.commit());
      }

      if (commitPromises.length > 0) {
        await Promise.all(commitPromises);
      }

      // Update project google sheet settings
      const googleSheetConfig = {
        url,
        sheetId: spreadsheetId,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedBy: userEmail,
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        importedCount: validCount,
        headers: headers, // Save the dynamic headers
      };

      await projectRef.update({
        googleSheet: googleSheetConfig,
      });

      await logAudit(projectId, userEmail, "Google Sheet Connected");
      await logAudit(projectId, userEmail, `Import Completed. Imported ${validCount} test cases.`);

      return NextResponse.json({
        success: true,
        importedCount: validCount,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE disconnect Google Sheet
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";

    const projectRef = adminDb.collection("projects").doc(projectId);
    const doc = await projectRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete googleSheet field
    await projectRef.update({
      googleSheet: admin.firestore.FieldValue.delete(),
    });

    // Fetch and delete all test case documents for this project (chunked to prevent Firestore batch limit error)
    const testCasesSnap = await projectRef.collection("test_cases").get();
    const docs = testCasesSnap.docs;
    const chunkSize = 500;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = adminDb.batch();
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    await logAudit(projectId, userEmail, "Google Sheet Disconnected");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
