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

// Compare values safely
function valEquals(v1: any, v2: any): boolean {
  const str1 = v1 === undefined || v1 === null ? "" : String(v1).trim();
  const str2 = v2 === undefined || v2 === null ? "" : String(v2).trim();
  return str1 === str2;
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
  const startTime = Date.now();
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";

    // 1. Fetch connected Google Sheet details
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

    // 2. Fetch sheet rows
    const accessToken = await getGoogleAuthToken();
    let sheets: string[];
    try {
      sheets = await getSpreadsheetSheets(spreadsheetId, accessToken);
    } catch (err: any) {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@cbqaops.iam.gserviceaccount.com";
      const url = googleSheet.url;
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
          error: `Google Sheet Not Found. Please verify that the connected spreadsheet URL "${url}" is correct.`
        }, { status: 400 });
      }
      return NextResponse.json({ error: err.message || "Unable to access Google Sheet" }, { status: 400 });
    }

    const firstSheetName = sheets[0];
    const rawRows = await getSheetValues(spreadsheetId, firstSheetName, accessToken);
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Sheet Contains Invalid Structure" }, { status: 400 });
    }

    const headers = rawRows[0];
    let tcIdIndex = findHeaderIndex(headers, "Test Case ID");
    if (tcIdIndex === -1) tcIdIndex = findHeaderIndex(headers, "ID");
    if (tcIdIndex === -1) tcIdIndex = findHeaderIndex(headers, "TC ID");

    let titleIndex = findHeaderIndex(headers, "Test Case Title");
    if (titleIndex === -1) titleIndex = findHeaderIndex(headers, "Title");
    if (titleIndex === -1) titleIndex = findHeaderIndex(headers, "Test Case Name");

    if (tcIdIndex === -1 || titleIndex === -1) {
      return NextResponse.json({ error: "Sheet is missing Test Case ID or Title columns" }, { status: 400 });
    }

    // Required columns mapping
    const colIndexes = {
      testCaseId: tcIdIndex,
      module: findHeaderIndex(headers, "Module"),
      title: titleIndex,
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

    // 3. Retrieve all portal test cases
    const testCasesCollection = projectRef.collection("test_cases");
    const testCasesSnap = await testCasesCollection.get();
    const portalCases = new Map<string, any>();
    testCasesSnap.docs.forEach(doc => {
      portalCases.set(doc.id, { _ref: doc.ref, ...doc.data() });
    });

    // 4. Synchronization loop logic
    const toCreateInPortal: any[] = [];
    const toUpdateInPortal: any[] = [];
    const toUpdateInSheet: { rowNumber: number; data: any }[] = [];
    const conflicts: any[] = [];
    const idsSeenInSheet = new Set<string>();

    let newRecordsCount = 0;
    let updatedRecordsCount = 0;
    let inactiveRecordsCount = 0;
    let failedRecordsCount = 0;

    // We process each row of the sheet
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];

      // Skip completely empty rows
      const isRowEmpty = row.every(cell => !cell || cell.trim() === "");
      if (isRowEmpty) {
        continue;
      }

      let tcId = (colIndexes.testCaseId !== -1 ? row[colIndexes.testCaseId] || "" : "").trim();
      let title = (colIndexes.title !== -1 ? row[colIndexes.title] || "" : "").trim();

      let needsSheetUpdate = false;
      const cellUpdatesToApply: CellUpdate[] = [];

      if (!tcId) {
        const candidateId = `TC-ROW-${i + 1}`;
        let suffix = 1;
        let finalId = candidateId;
        while (idsSeenInSheet.has(finalId) || portalCases.has(finalId)) {
          finalId = `${candidateId}-${suffix++}`;
        }
        tcId = finalId;
        needsSheetUpdate = true;
        if (colIndexes.testCaseId !== -1) {
          cellUpdatesToApply.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.testCaseId)}${i + 1}`,
            values: [[tcId]],
          });
        }
      }

      if (!title) {
        title = `Test Case Row ${i + 1}`;
        needsSheetUpdate = true;
        if (colIndexes.title !== -1) {
          cellUpdatesToApply.push({
            range: `${firstSheetName}!${getColLetter(colIndexes.title)}${i + 1}`,
            values: [[title]],
          });
        }
      }

      if (needsSheetUpdate && cellUpdatesToApply.length > 0) {
        try {
          await updateSheetValuesBatch(spreadsheetId, cellUpdatesToApply, accessToken);
          // Update the local in-memory row values so downstream logic has them
          if (colIndexes.testCaseId !== -1) row[colIndexes.testCaseId] = tcId;
          if (colIndexes.title !== -1) row[colIndexes.title] = title;
        } catch (e) {
          console.error("Failed to write back generated ID/Title to sheet:", e);
        }
      }

      idsSeenInSheet.add(tcId);

      // Parse sheet values for this row
      const rawRowObj: Record<string, any> = {};
      headers.forEach((col, idx) => {
        rawRowObj[col] = row[idx] || "";
      });

      const devStatusCol = headers[colIndexes.devStatus];
      const devDateCol = headers[colIndexes.devDateExecuted];
      const devNotesCol = headers[colIndexes.devNotes];
      const qaStatusCol = headers[colIndexes.qaStatus];
      const cbVerifiedCol = headers[colIndexes.crossBrowserVerified];
      const priorityCol = headers[colIndexes.priority];
      const jiraCol = headers[colIndexes.jiraTicket];
      const moduleCol = headers[colIndexes.module];

      // Parse sheet values for this row
      const sheetCaseData = {
        ...rawRowObj, // Dynamically keep all custom column values!
        testCaseId: tcId,
        module: moduleCol ? rawRowObj[moduleCol] || "" : "",
        title: title,
        preConditions: colIndexes.preConditions !== -1 ? row[colIndexes.preConditions] || "" : "",
        testSteps: colIndexes.testSteps !== -1 ? row[colIndexes.testSteps] || "" : "",
        testData: colIndexes.testData !== -1 ? row[colIndexes.testData] || "" : "",
        expectedResult: colIndexes.expectedResult !== -1 ? row[colIndexes.expectedResult] || "" : "",
        devStatus: devStatusCol ? rawRowObj[devStatusCol] || "Not Started" : "Not Started",
        devDateExecuted: devDateCol ? rawRowObj[devDateCol] || "" : "",
        devNotes: devNotesCol ? rawRowObj[devNotesCol] || "" : "",
        qaStatus: qaStatusCol ? rawRowObj[qaStatusCol] || "Not Run" : "Not Run",
        crossBrowserVerified: cbVerifiedCol ? rawRowObj[cbVerifiedCol] || "No" : "No",
        priority: priorityCol ? rawRowObj[priorityCol] || "Medium" : "Medium",
        jiraTicket: jiraCol ? rawRowObj[jiraCol] || "" : "",
      };

      const portalCase = portalCases.get(tcId);

      if (!portalCase) {
        // SCENARIO 1: Newly added row in Google Sheet
        toCreateInPortal.push(sheetCaseData);
        newRecordsCount++;
      } else {
        // SCENARIO 2: Existing test case, check modifications relative to lastSyncedValues
        const lastSynced = portalCase.lastSyncedValues || {};

        // A. Check if Sheet values changed
        let sheetModified = false;
        const keysToCompare = Object.keys(sheetCaseData) as Array<keyof typeof sheetCaseData>;
        for (const key of keysToCompare) {
          if (!valEquals(sheetCaseData[key], lastSynced[key])) {
            sheetModified = true;
            break;
          }
        }

        // B. Check if Portal values changed (for the editable status/execution fields only)
        const portalEditableKeys = [
          "devStatus",
          "devDateExecuted",
          "devNotes",
          "qaStatus",
          "crossBrowserVerified",
        ];
        let portalModified = false;
        for (const key of portalEditableKeys) {
          if (!valEquals(portalCase[key], lastSynced[key])) {
            portalModified = true;
            break;
          }
        }

        if (sheetModified && portalModified) {
          // Both sides were modified. Is there an actual value mismatch?
          let actualMismatch = false;
          for (const key of keysToCompare) {
            const portalVal = key in portalCase ? portalCase[key] : sheetCaseData[key];
            if (!valEquals(sheetCaseData[key], portalVal)) {
              actualMismatch = true;
              break;
            }
          }

          if (actualMismatch) {
            // CONFLICT DETECTED
            conflicts.push({
              testCaseId: tcId,
              sheetValues: sheetCaseData,
              portalValues: {
                testCaseId: tcId,
                module: portalCase.module || "",
                title: portalCase.title || "",
                preConditions: portalCase.preConditions || "",
                testSteps: portalCase.testSteps || "",
                testData: portalCase.testData || "",
                expectedResult: portalCase.expectedResult || "",
                devStatus: portalCase.devStatus || "Not Started",
                devDateExecuted: portalCase.devDateExecuted || "",
                devNotes: portalCase.devNotes || "",
                qaStatus: portalCase.qaStatus || "Not Run",
                crossBrowserVerified: portalCase.crossBrowserVerified || "No",
                priority: portalCase.priority || "Medium",
                jiraTicket: portalCase.jiraTicket || "",
              },
              rowNumber: i + 1,
            });
          } else {
            // Values are identical now, just update lastSyncedValues snapshot
            toUpdateInPortal.push({
              testCaseId: tcId,
              dbData: {
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSyncedValues: sheetCaseData,
              },
            });
          }
        } else if (sheetModified) {
          // Only Google Sheet was modified: Pull to Portal
          toUpdateInPortal.push({
            testCaseId: tcId,
            dbData: {
              ...sheetCaseData,
              status: "active",
              lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSyncedValues: sheetCaseData,
            },
          });
          updatedRecordsCount++;
        } else if (portalModified) {
          // Only Portal was modified: Push to Google Sheet
          toUpdateInSheet.push({
            rowNumber: i + 1,
            data: {
              devStatus: portalCase.devStatus,
              devDateExecuted: portalCase.devDateExecuted,
              devNotes: portalCase.devNotes,
              qaStatus: portalCase.qaStatus,
              crossBrowserVerified: portalCase.crossBrowserVerified,
            },
          });
          // Note: we update lastSyncedValues in DB once sheet update succeeds
          toUpdateInPortal.push({
            testCaseId: tcId,
            dbData: {
              lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSyncedValues: {
                ...sheetCaseData,
                devStatus: portalCase.devStatus,
                devDateExecuted: portalCase.devDateExecuted,
                devNotes: portalCase.devNotes,
                qaStatus: portalCase.qaStatus,
                crossBrowserVerified: portalCase.crossBrowserVerified,
              },
            },
          });
          updatedRecordsCount++;
        } else {
          // Neither changed, but if status was marked inactive, restore it to active
          if (portalCase.status === "inactive") {
            toUpdateInPortal.push({
              testCaseId: tcId,
              dbData: {
                status: "active",
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            });
            updatedRecordsCount++;
          }
        }
      }
    }

    // SCENARIO 3: Removed rows from sheet -> Mark inactive in Portal
    const toMarkInactiveInDb: any[] = [];
    portalCases.forEach((val, key) => {
      if (!idsSeenInSheet.has(key) && val.status !== "inactive") {
        toMarkInactiveInDb.push(val);
        inactiveRecordsCount++;
      }
    });

    // 5. Apply changes to Portal Firestore
    const batchChunksLimit = 500;

    // Apply creations
    for (let i = 0; i < toCreateInPortal.length; i += batchChunksLimit) {
      const chunk = toCreateInPortal.slice(i, i + batchChunksLimit);
      const batch = adminDb.batch();
      chunk.forEach(tc => {
        const docRef = testCasesCollection.doc(tc.testCaseId);
        batch.set(docRef, {
          ...tc,
          status: "active",
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncedValues: tc,
        });
      });
      await batch.commit();
    }

    // Apply updates
    for (let i = 0; i < toUpdateInPortal.length; i += batchChunksLimit) {
      const chunk = toUpdateInPortal.slice(i, i + batchChunksLimit);
      const batch = adminDb.batch();
      chunk.forEach(updateItem => {
        const docRef = testCasesCollection.doc(updateItem.testCaseId);
        batch.update(docRef, updateItem.dbData);
      });
      await batch.commit();
    }

    // Apply inactive flags
    for (let i = 0; i < toMarkInactiveInDb.length; i += batchChunksLimit) {
      const chunk = toMarkInactiveInDb.slice(i, i + batchChunksLimit);
      const batch = adminDb.batch();
      chunk.forEach(doc => {
        batch.update(doc._ref, {
          status: "inactive",
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    // 6. Push Portal changes to Google Sheet in batch
    const cellUpdates: CellUpdate[] = [];
    toUpdateInSheet.forEach(item => {
      const rNum = item.rowNumber;
      const data = item.data;

      if (colIndexes.devStatus !== -1 && data.devStatus !== undefined) {
        cellUpdates.push({
          range: `${firstSheetName}!${getColLetter(colIndexes.devStatus)}${rNum}`,
          values: [[data.devStatus]],
        });
      }
      if (colIndexes.devDateExecuted !== -1 && data.devDateExecuted !== undefined) {
        cellUpdates.push({
          range: `${firstSheetName}!${getColLetter(colIndexes.devDateExecuted)}${rNum}`,
          values: [[data.devDateExecuted]],
        });
      }
      if (colIndexes.devNotes !== -1 && data.devNotes !== undefined) {
        cellUpdates.push({
          range: `${firstSheetName}!${getColLetter(colIndexes.devNotes)}${rNum}`,
          values: [[data.devNotes]],
        });
      }
      if (colIndexes.qaStatus !== -1 && data.qaStatus !== undefined) {
        cellUpdates.push({
          range: `${firstSheetName}!${getColLetter(colIndexes.qaStatus)}${rNum}`,
          values: [[data.qaStatus]],
        });
      }
      if (colIndexes.crossBrowserVerified !== -1 && data.crossBrowserVerified !== undefined) {
        cellUpdates.push({
          range: `${firstSheetName}!${getColLetter(colIndexes.crossBrowserVerified)}${rNum}`,
          values: [[data.crossBrowserVerified]],
        });
      }
    });

    if (cellUpdates.length > 0) {
      await updateSheetValuesBatch(spreadsheetId, cellUpdates, accessToken);
    }

    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    const syncStatus = conflicts.length > 0 ? "CONFLICT" : "COMPLETED";

    // 7. Write Sync History Log
    const syncLogRef = await projectRef.collection("sync_history").add({
      syncTime: admin.firestore.FieldValue.serverTimestamp(),
      triggeredBy: userEmail,
      createdRecords: newRecordsCount,
      updatedRecords: updatedRecordsCount,
      inactiveRecords: inactiveRecordsCount,
      failedRecords: failedRecordsCount + conflicts.length,
      status: syncStatus,
      duration: durationSeconds,
    });

    // Write Audits
    await projectRef.collection("audit_logs").add({
      user: userEmail,
      action: `Sync Started`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await projectRef.collection("audit_logs").add({
      user: userEmail,
      action: `Sync Completed. Created: ${newRecordsCount}, Updated: ${updatedRecordsCount}, Inactive: ${inactiveRecordsCount}, Conflicts: ${conflicts.length}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update project lastSyncDate and headers
    await projectRef.update({
      "googleSheet.lastSyncAt": admin.firestore.FieldValue.serverTimestamp(),
      "googleSheet.headers": headers,
    });

    return NextResponse.json({
      success: true,
      status: syncStatus,
      summary: {
        newRecords: newRecordsCount,
        updatedRecords: updatedRecordsCount,
        inactiveRecords: inactiveRecordsCount,
        failedRecords: failedRecordsCount,
        conflictRecords: conflicts.length,
        duration: durationSeconds,
        lastSyncTime: new Date().toISOString(),
      },
      conflicts,
    });
  } catch (error: any) {
    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    
    // Log Sync Failure
    try {
      const { id: projectId } = await params;
      const projectRef = adminDb.collection("projects").doc(projectId);
      
      await projectRef.collection("sync_history").add({
        syncTime: admin.firestore.FieldValue.serverTimestamp(),
        triggeredBy: "System",
        createdRecords: 0,
        updatedRecords: 0,
        inactiveRecords: 0,
        failedRecords: 0,
        status: "FAILED",
        duration: durationSeconds,
      });

      await projectRef.collection("audit_logs").add({
        user: "System",
        action: `Sync Failed: ${error.message || "Unknown error"}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to log failed sync in firestore", e);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
