import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import {
  getGoogleAuthToken,
  getSpreadsheetSheets,
  getSheetValues,
  updateSheetValuesBatch,
  CellUpdate,
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

// Map column index to letters
function getColLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";
    const body = await req.json();
    const { resolutions } = body; // resolutions: [{ testCaseId: string, choice: 'portal' | 'sheet' }]

    if (!resolutions || !Array.isArray(resolutions) || resolutions.length === 0) {
      return NextResponse.json({ error: "Resolutions array is required and cannot be empty" }, { status: 400 });
    }

    const projectRef = adminDb.collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data() as any;
    const googleSheet = projectData.googleSheet;
    if (!googleSheet || !googleSheet.url) {
      return NextResponse.json({ error: "No Google Sheet connected to this project" }, { status: 400 });
    }

    const spreadsheetId = googleSheet.sheetId;

    // Fetch sheet rows
    const accessToken = await getGoogleAuthToken();
    const sheets = await getSpreadsheetSheets(spreadsheetId, accessToken);
    if (sheets.length === 0) {
      return NextResponse.json({ error: "Sheet Contains Invalid Structure" }, { status: 400 });
    }

    const firstSheetName = sheets[0];
    const rawRows = await getSheetValues(spreadsheetId, firstSheetName, accessToken);
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Sheet Contains Invalid Structure" }, { status: 400 });
    }

    const headers = rawRows[0];
    const tcIdIndex = findHeaderIndex(headers, "Test Case ID");

    if (tcIdIndex === -1) {
      return NextResponse.json({ error: "Sheet is missing Test Case ID column" }, { status: 400 });
    }

    const colIndexes = {
      testCaseId: findHeaderIndex(headers, "Test Case ID"),
      module: findHeaderIndex(headers, "Module"),
      title: findHeaderIndex(headers, "Test Case Title"),
      preConditions: findHeaderIndex(headers, "Pre-Conditions"),
      testSteps: findHeaderIndex(headers, "Test Steps"),
      testData: findHeaderIndex(headers, "Test Data"),
      expectedResult: findHeaderIndex(headers, "Expected Result"),
      devStatus: findHeaderIndex(headers, "Dev Status"),
      devDateExecuted: findHeaderIndex(headers, "Dev Date Executed"),
      devNotes: findHeaderIndex(headers, "Dev Notes"),
      qaStatus: findHeaderIndex(headers, "QA Status"),
      crossBrowserVerified: findHeaderIndex(headers, "cross browser Verfied ?"),
      priority: findHeaderIndex(headers, "Priority"),
      jiraTicket: findHeaderIndex(headers, "JIRA Ticket"),
    };

    const cellUpdates: CellUpdate[] = [];
    const testCasesCollection = projectRef.collection("test_cases");
    const batch = adminDb.batch();

    // Process resolutions
    for (const resItem of resolutions) {
      const { testCaseId, choice } = resItem;
      const tcRef = testCasesCollection.doc(testCaseId);
      const tcSnap = await tcRef.get();

      if (!tcSnap.exists) continue;

      const portalCase = tcSnap.data() as any;

      // Find matching row in Google Sheet
      let rowIndex = -1;
      let sheetCaseData: any = null;
      
      for (let i = 1; i < rawRows.length; i++) {
        if ((rawRows[i][tcIdIndex] || "").trim() === testCaseId) {
          rowIndex = i + 1; // 1-indexed row number
          
          const row = rawRows[i];
          sheetCaseData = {
            testCaseId,
            module: colIndexes.module !== -1 ? row[colIndexes.module] || "" : "",
            title: colIndexes.title !== -1 ? row[colIndexes.title] || "" : "",
            preConditions: colIndexes.preConditions !== -1 ? row[colIndexes.preConditions] || "" : "",
            testSteps: colIndexes.testSteps !== -1 ? row[colIndexes.testSteps] || "" : "",
            testData: colIndexes.testData !== -1 ? row[colIndexes.testData] || "" : "",
            expectedResult: colIndexes.expectedResult !== -1 ? row[colIndexes.expectedResult] || "" : "",
            devStatus: colIndexes.devStatus !== -1 ? row[colIndexes.devStatus] || "Not Started" : "Not Started",
            devDateExecuted: colIndexes.devDateExecuted !== -1 ? row[colIndexes.devDateExecuted] || "" : "",
            devNotes: colIndexes.devNotes !== -1 ? row[colIndexes.devNotes] || "" : "",
            qaStatus: colIndexes.qaStatus !== -1 ? row[colIndexes.qaStatus] || "Not Run" : "Not Run",
            crossBrowserVerified: colIndexes.crossBrowserVerified !== -1 ? row[colIndexes.crossBrowserVerified] || "No" : "No",
            priority: colIndexes.priority !== -1 ? row[colIndexes.priority] || "Medium" : "Medium",
            jiraTicket: colIndexes.jiraTicket !== -1 ? row[colIndexes.jiraTicket] || "" : "",
          };
          break;
        }
      }

      if (rowIndex === -1 || !sheetCaseData) {
        continue; // Row was deleted or missing
      }

      if (choice === "portal") {
        // Option 1: Keep Portal Version (Push portal values to sheet)
        const data = {
          devStatus: portalCase.devStatus,
          devDateExecuted: portalCase.devDateExecuted,
          devNotes: portalCase.devNotes,
          qaStatus: portalCase.qaStatus,
          crossBrowserVerified: portalCase.crossBrowserVerified,
        };

        if (colIndexes.devStatus !== -1 && data.devStatus !== undefined) {
          cellUpdates.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.devStatus)}${rowIndex}`,
            values: [[data.devStatus]],
          });
        }
        if (colIndexes.devDateExecuted !== -1 && data.devDateExecuted !== undefined) {
          cellUpdates.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.devDateExecuted)}${rowIndex}`,
            values: [[data.devDateExecuted]],
          });
        }
        if (colIndexes.devNotes !== -1 && data.devNotes !== undefined) {
          cellUpdates.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.devNotes)}${rowIndex}`,
            values: [[data.devNotes]],
          });
        }
        if (colIndexes.qaStatus !== -1 && data.qaStatus !== undefined) {
          cellUpdates.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.qaStatus)}${rowIndex}`,
            values: [[data.qaStatus]],
          });
        }
        if (colIndexes.crossBrowserVerified !== -1 && data.crossBrowserVerified !== undefined) {
          cellUpdates.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.crossBrowserVerified)}${rowIndex}`,
            values: [[data.crossBrowserVerified]],
          });
        }

        // Update lastSyncedValues to match current portal case
        batch.update(tcRef, {
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncedValues: {
            ...sheetCaseData,
            devStatus: portalCase.devStatus,
            devDateExecuted: portalCase.devDateExecuted,
            devNotes: portalCase.devNotes,
            qaStatus: portalCase.qaStatus,
            crossBrowserVerified: portalCase.crossBrowserVerified,
          },
        });

        await projectRef.collection("audit_logs").add({
          user: userEmail,
          action: `Conflict Resolved: Kept Portal Version for ${testCaseId}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (choice === "sheet") {
        // Option 2: Keep Google Sheet Version (Pull sheet values to portal)
        batch.update(tcRef, {
          ...sheetCaseData,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncedValues: sheetCaseData,
        });

        await projectRef.collection("audit_logs").add({
          user: userEmail,
          action: `Conflict Resolved: Kept Google Sheet Version for ${testCaseId}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Apply sheet cell updates
    if (cellUpdates.length > 0) {
      await updateSheetValuesBatch(spreadsheetId, cellUpdates, accessToken);
    }

    // Commit Firestore updates
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
