export const dynamic = 'force-dynamic';

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
  findHeaderIndex,
  getSpreadsheetSheetsMetadata,
  deleteSpreadsheetRow,
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

// Helper function to map 0-indexed column number to Excel letter (A, B, C... Z, AA, AB...)
function getColLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * GET list of test cases with in-memory search, filter, and pagination
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const moduleFilter = searchParams.get("module") || "all";
    const priorityFilter = searchParams.get("priority") || "all";
    const devStatusFilter = searchParams.get("devStatus") || "all";
    const qaStatusFilter = searchParams.get("qaStatus") || "all";
    const cbVerifiedFilter = searchParams.get("crossBrowserVerified") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const testCasesSnap = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("test_cases")
      .get();

    let testCases = testCasesSnap.docs.map(doc => doc.data() as any);

    // Apply Search (Case insensitive, search in ID, Title, JIRA Ticket)
    if (search) {
      testCases = testCases.filter(
        tc =>
          (tc.testCaseId || "").toLowerCase().includes(search) ||
          (tc.title || "").toLowerCase().includes(search) ||
          (tc.jiraTicket || "").toLowerCase().includes(search)
      );
    }

    // Helper to parse multi-select parameters
    const parseMultiFilter = (val: string) => {
      if (val === "all" || !val) return null;
      return val.split(",").map(s => s.trim().toLowerCase());
    };

    const modules = parseMultiFilter(moduleFilter);
    const priorities = parseMultiFilter(priorityFilter);
    const devStatuses = parseMultiFilter(devStatusFilter);
    const qaStatuses = parseMultiFilter(qaStatusFilter);
    const cbVerifieds = parseMultiFilter(cbVerifiedFilter);

    // Apply Filters (multi-select arrays)
    if (modules) {
      testCases = testCases.filter(tc => modules.includes((tc.module || "").trim().toLowerCase()));
    }
    if (priorities) {
      testCases = testCases.filter(tc => priorities.includes((tc.priority || "").trim().toLowerCase()));
    }
    if (devStatuses) {
      testCases = testCases.filter(tc => devStatuses.includes((tc.devStatus || "").trim().toLowerCase()));
    }
    if (qaStatuses) {
      testCases = testCases.filter(tc => qaStatuses.includes((tc.qaStatus || "").trim().toLowerCase()));
    }
    if (cbVerifieds) {
      testCases = testCases.filter(tc => cbVerifieds.includes((tc.crossBrowserVerified || "").trim().toLowerCase()));
    }

    // Sort by Test Case ID naturally
    testCases.sort((a, b) => {
      const aId = a.testCaseId || "";
      const bId = b.testCaseId || "";
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
    });

    // Pagination
    const total = testCases.length;
    const startIndex = (page - 1) * limit;
    const paginatedCases = testCases.slice(startIndex, startIndex + limit);

    // Get unique values for dropdowns (using unfiltered lists)
    const allDocs = testCasesSnap.docs.map(doc => doc.data() as any);
    const uniqueModules = Array.from(new Set(allDocs.map(tc => (tc.module || "").trim()).filter(Boolean))).sort();
    const uniquePriorities = Array.from(new Set(allDocs.map(tc => (tc.priority || "").trim()).filter(Boolean))).sort();

    // Compute overall metrics on the server
    const devCounts: Record<string, number> = { Pass: 0, Fail: 0, TBD: 0, Pending: 0, "N/A": 0 };
    const qaCounts: Record<string, number> = { Pass: 0, Fail: 0, TBD: 0, Pending: 0, "N/A": 0 };

    const normalizeStatus = (val: any) => {
      if (!val) return "Pending";
      const lower = String(val).trim().toLowerCase();
      if (lower === "pass" || lower === "passed" || lower === "✓") return "Pass";
      if (lower === "fail" || lower === "failed" || lower === "✗") return "Fail";
      if (lower === "blocked" || lower === "tbd" || lower === "to be done") return "TBD";
      if (lower === "n/a" || lower === "na" || lower === "not applicable") return "N/A";
      return "Pending";
    };

    allDocs.forEach(tc => {
      const devStatus = normalizeStatus(tc.devStatus);
      const qaStatus = normalizeStatus(tc.qaStatus);
      if (devStatus in devCounts) devCounts[devStatus]++;
      if (qaStatus in qaCounts) qaCounts[qaStatus]++;
    });

    const devTotal = allDocs.length;
    const devCompleted = devTotal - devCounts.Pending - devCounts.TBD;
    const devPassRate = devTotal > 0 ? Math.round((devCounts.Pass / devTotal) * 100) : 0;

    const qaTotal = allDocs.length;
    const qaCompleted = qaTotal - qaCounts.Pending - qaCounts.TBD;
    const qaPassRate = qaTotal > 0 ? Math.round((qaCounts.Pass / qaTotal) * 100) : 0;

    const metrics = {
      dev: { total: devTotal, completed: devCompleted, passRate: devPassRate, ...devCounts },
      qa: { total: qaTotal, completed: qaCompleted, passRate: qaPassRate, ...qaCounts },
    };

    return NextResponse.json({
      testCases: paginatedCases,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      uniqueModules,
      uniquePriorities,
      metrics,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST create a new test case and sync to Google Sheet
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
    const { 
      testCaseId, 
      title, 
      module, 
      priority, 
      devStatus, 
      qaStatus,
      crossBrowserVerified,
      preConditions,
      testSteps,
      testData,
      expectedResult,
      jiraTicket,
      devNotes,
      devDateExecuted
    } = body;

    if (!testCaseId || !title) {
      return NextResponse.json({ error: "Missing required fields (testCaseId or title)" }, { status: 400 });
    }

    const projectRef = adminDb.collection("projects").doc(projectId);
    const tcRef = projectRef.collection("test_cases").doc(testCaseId);
    
    // Check if test case already exists
    const tcSnap = await tcRef.get();
    if (tcSnap.exists) {
      return NextResponse.json({ error: "Test Case ID already exists" }, { status: 400 });
    }

    const projectSnap = await projectRef.get();
    const projectData = projectSnap.data() as any;
    const googleSheet = projectData.googleSheet;

    const docData: any = {
      testCaseId,
      title,
      module: module || "",
      priority: priority || "Medium",
      devStatus: devStatus || "Not Started",
      devDateExecuted: devDateExecuted || "",
      devNotes: devNotes || "",
      qaStatus: qaStatus || "Not Run",
      crossBrowserVerified: crossBrowserVerified || "No",
      preConditions: preConditions || "",
      testSteps: testSteps || "",
      testData: testData || "",
      expectedResult: expectedResult || "",
      jiraTicket: jiraTicket || "",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let syncSuccess = false;
    let syncErrorMsg = "";

    if (googleSheet && googleSheet.url) {
      try {
        const spreadsheetId = googleSheet.sheetId;
        const accessToken = await getGoogleAuthToken();
        const sheets = await getSpreadsheetSheets(spreadsheetId, accessToken);
        
        if (sheets.length > 0) {
          const firstSheetName = sheets[0];
          const rawRows = await getSheetValues(spreadsheetId, firstSheetName, accessToken);
          const headers = rawRows.length > 0 ? rawRows[0] : googleSheet.headers || [];

          if (headers.length > 0) {
            const newRowNumber = rawRows.length + 1;
            
            // Map the testcase properties to sheet headers
            const newRowValues = headers.map((col: string) => {
              const colKey = col.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
              if (colKey === "testcaseid" || colKey === "tcid" || colKey === "id") return testCaseId;
              if (colKey === "testcasetitle" || colKey === "title" || colKey === "testcasename") return title;
              if (colKey === "module") return module || "";
              if (colKey === "preconditions") return preConditions || "";
              if (colKey === "teststeps") return testSteps || "";
              if (colKey === "testdata") return testData || "";
              if (colKey === "expectedresult") return expectedResult || "";
              if (colKey === "devstatus") return devStatus || "Not Started";
              if (colKey === "devdateexecuted") return devDateExecuted || "";
              if (colKey === "devnotes") return devNotes || "";
              if (colKey === "qastatus") return qaStatus || "Not Run";
              if (colKey === "crossbrowserverified" || colKey === "crossbrowserverfied") return crossBrowserVerified || "No";
              if (colKey === "priority") return priority || "Medium";
              if (colKey === "jiraticket") return jiraTicket || "";
              return "";
            });

            // Write row to Google Sheet
            const cellUpdates = [{
              range: `${firstSheetName}!A${newRowNumber}:${getColLetter(headers.length - 1)}${newRowNumber}`,
              values: [newRowValues],
            }];

            await updateSheetValuesBatch(spreadsheetId, cellUpdates, accessToken);
            
            // Also store what was synced
            docData.lastSyncedAt = admin.firestore.FieldValue.serverTimestamp();
            
            const lastSyncedObj: Record<string, any> = {};
            headers.forEach((h: string, idx: number) => {
              lastSyncedObj[h] = newRowValues[idx];
            });
            docData.lastSyncedValues = lastSyncedObj;

            syncSuccess = true;
          }
        }
      } catch (err: any) {
        console.error("Failed to sync new testcase to Google Sheet:", err);
        syncErrorMsg = err.message || "Failed to sync to Google Sheet";
      }
    }

    // Save in Firestore
    await tcRef.set(docData);

    // Write audit logs
    await adminDb.collection("projects").doc(projectId).collection("audit_logs").add({
      user: userEmail,
      action: `Created test case ${testCaseId} in portal. Google Sheet sync: ${syncSuccess ? "SUCCESS" : "FAILED (" + syncErrorMsg + ")"}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      testCase: docData,
      synced: syncSuccess,
      syncError: syncErrorMsg || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT update test case status in portal and automatically sync back to Google Sheet (supports single and bulk updates)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";
    const body = await req.json();
    const { 
      testCaseId, 
      testCaseIds,
      columnName, 
      value,
      devStatus, 
      devDateExecuted, 
      devNotes, 
      qaStatus, 
      crossBrowserVerified,
      priority
    } = body;

    const idsToUpdate = Array.isArray(testCaseIds) ? testCaseIds : (testCaseId ? [testCaseId] : []);
    if (idsToUpdate.length === 0) {
      return NextResponse.json({ error: "Missing testCaseId or testCaseIds" }, { status: 400 });
    }

    const projectRef = adminDb.collection("projects").doc(projectId);

    // Retrieve updated test case document to get complete fields
    const projectSnap = await projectRef.get();
    const projectData = projectSnap.data() as any;
    const googleSheet = projectData.googleSheet;

    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (columnName) {
      updates[columnName] = value;
      
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
      const normName = normalize(columnName);
      if (normName === "devstatus") updates.devStatus = value;
      else if (normName === "qastatus") updates.qaStatus = value;
      else if (normName === "devdateexecuted") updates.devDateExecuted = value;
      else if (normName === "devnotes") updates.devNotes = value;
      else if (normName === "crossbrowserverfied" || normName === "crossbrowserverified") updates.crossBrowserVerified = value;
      else if (normName === "priority") updates.priority = value;
      else if (normName === "jiraticket") updates.jiraTicket = value;
      else if (normName === "module") updates.module = value;
      else if (normName === "testcasetitle") {
        updates.title = value;
        if (!value) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
    } else {
      const headers = googleSheet?.headers || [];
      if (devStatus !== undefined) {
        updates.devStatus = devStatus;
        const colIdx = findHeaderIndex(headers, "Dev Status");
        if (colIdx !== -1) updates[headers[colIdx]] = devStatus;
        else updates["Dev Status"] = devStatus;
      }
      if (devDateExecuted !== undefined) {
        updates.devDateExecuted = devDateExecuted;
        const colIdx = findHeaderIndex(headers, "Dev Date Executed");
        if (colIdx !== -1) updates[headers[colIdx]] = devDateExecuted;
        else updates["Dev Date Executed"] = devDateExecuted;
      }
      if (devNotes !== undefined) {
        updates.devNotes = devNotes;
        const colIdx = findHeaderIndex(headers, "Dev Notes");
        if (colIdx !== -1) updates[headers[colIdx]] = devNotes;
        else updates["Dev Notes"] = devNotes;
      }
      if (qaStatus !== undefined) {
        updates.qaStatus = qaStatus;
        const colIdx = findHeaderIndex(headers, "QA Status");
        if (colIdx !== -1) updates[headers[colIdx]] = qaStatus;
        else updates["QA Status"] = qaStatus;
      }
      if (crossBrowserVerified !== undefined) {
        updates.crossBrowserVerified = crossBrowserVerified;
        const colIdx = findHeaderIndex(headers, "cross browser Verfied ?");
        if (colIdx !== -1) updates[headers[colIdx]] = crossBrowserVerified;
        else updates["cross browser Verfied ?"] = crossBrowserVerified;
      }
      if (priority !== undefined) {
        updates.priority = priority;
        const colIdx = findHeaderIndex(headers, "Priority");
        if (colIdx !== -1) updates[headers[colIdx]] = priority;
        else updates["Priority"] = priority;
      }
    }

    let syncSuccess = false;
    let syncErrorMsg = "";

    if (googleSheet && googleSheet.url) {
      try {
        const spreadsheetId = googleSheet.sheetId;
        const accessToken = await getGoogleAuthToken();
        const sheets = await getSpreadsheetSheets(spreadsheetId, accessToken);
        
        if (sheets.length > 0) {
          const firstSheetName = sheets[0];
          const rawRows = await getSheetValues(spreadsheetId, firstSheetName, accessToken);
          
          if (rawRows.length > 0) {
            const headers = rawRows[0];
            let tcIdColIndex = findHeaderIndex(headers, "Test Case ID");
            if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "ID");
            if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "TC ID");
            
            if (tcIdColIndex !== -1) {
              const cellUpdates: any[] = [];
              const idsNotFound: string[] = [];

              for (const id of idsToUpdate) {
                // Find matching row in Google Sheet
                let rowNumber = -1;
                for (let i = 1; i < rawRows.length; i++) {
                  if ((rawRows[i][tcIdColIndex] || "").trim() === id) {
                    rowNumber = i + 1; // 1-indexed row number
                    break;
                  }
                }

                if (rowNumber !== -1) {
                  if (columnName) {
                    const colIndex = findHeaderIndex(headers, columnName);
                    if (colIndex !== -1) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(colIndex)}${rowNumber}`,
                        values: [[value]],
                      });
                    }
                  } else {
                    const devStatusIndex = findHeaderIndex(headers, "Dev Status");
                    const devDateIndex = findHeaderIndex(headers, "Dev Date Executed");
                    const devNotesIndex = findHeaderIndex(headers, "Dev Notes");
                    const qaStatusIndex = findHeaderIndex(headers, "QA Status");
                    const cbVerifiedIndex = findHeaderIndex(headers, "cross browser Verfied ?");
                    const priorityIndex = findHeaderIndex(headers, "Priority");

                    if (devStatusIndex !== -1 && devStatus !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(devStatusIndex)}${rowNumber}`,
                        values: [[devStatus]],
                      });
                    }
                    if (devDateIndex !== -1 && devDateExecuted !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(devDateIndex)}${rowNumber}`,
                        values: [[devDateExecuted]],
                      });
                    }
                    if (devNotesIndex !== -1 && devNotes !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(devNotesIndex)}${rowNumber}`,
                        values: [[devNotes]],
                      });
                    }
                    if (qaStatusIndex !== -1 && qaStatus !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(qaStatusIndex)}${rowNumber}`,
                        values: [[qaStatus]],
                      });
                    }
                    if (cbVerifiedIndex !== -1 && crossBrowserVerified !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(cbVerifiedIndex)}${rowNumber}`,
                        values: [[crossBrowserVerified]],
                      });
                    }
                    if (priorityIndex !== -1 && priority !== undefined) {
                      cellUpdates.push({
                        range: `${firstSheetName}!${getColLetter(priorityIndex)}${rowNumber}`,
                        values: [[priority]],
                      });
                    }
                  }
                } else {
                  idsNotFound.push(id);
                }
              }

              if (cellUpdates.length > 0) {
                await updateSheetValuesBatch(spreadsheetId, cellUpdates, accessToken);
                syncSuccess = true;
              }
              if (idsNotFound.length > 0) {
                syncErrorMsg = `IDs not found in sheet: ${idsNotFound.join(", ")}`;
              }
            } else {
              syncErrorMsg = "Required column 'Test Case ID' missing in Google Sheet.";
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to sync change to Google Sheet:", err);
        syncErrorMsg = err.message || "Failed to contact Google Sheets API.";
      }
    }

    // Save in Firestore using batch commits (chunks of 500)
    const testCasesCollection = projectRef.collection("test_cases");
    const chunksLimit = 500;
    
    for (let i = 0; i < idsToUpdate.length; i += chunksLimit) {
      const chunk = idsToUpdate.slice(i, i + chunksLimit);
      const batch = adminDb.batch();

      for (const id of chunk) {
        const tcRef = testCasesCollection.doc(id);
        const tcSnap = await tcRef.get();
        if (!tcSnap.exists) continue;
        const currentData = tcSnap.data() as any;

        const docUpdates = { ...updates };
        if (syncSuccess) {
          docUpdates.lastSyncedAt = admin.firestore.FieldValue.serverTimestamp();
          
          const updatedLastSyncedValues = {
            ...(currentData.lastSyncedValues || {}),
          };

          if (columnName) {
            updatedLastSyncedValues[columnName] = value;
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
            const normName = normalize(columnName);
            if (normName === "devstatus") updatedLastSyncedValues.devStatus = value;
            else if (normName === "qastatus") updatedLastSyncedValues.qaStatus = value;
            else if (normName === "devdateexecuted") updatedLastSyncedValues.devDateExecuted = value;
            else if (normName === "devnotes") updatedLastSyncedValues.devNotes = value;
            else if (normName === "crossbrowserverfied" || normName === "crossbrowserverified") updatedLastSyncedValues.crossBrowserVerified = value;
            else if (normName === "priority") updatedLastSyncedValues.priority = value;
            else if (normName === "jiraticket") updatedLastSyncedValues.jiraTicket = value;
            else if (normName === "module") updatedLastSyncedValues.module = value;
            else if (normName === "testcasetitle") updatedLastSyncedValues.title = value;
          } else {
            const headers = googleSheet?.headers || [];
            if (devStatus !== undefined) {
              updatedLastSyncedValues.devStatus = devStatus;
              const colIdx = findHeaderIndex(headers, "Dev Status");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = devStatus;
              else updatedLastSyncedValues["Dev Status"] = devStatus;
            }
            if (devDateExecuted !== undefined) {
              updatedLastSyncedValues.devDateExecuted = devDateExecuted;
              const colIdx = findHeaderIndex(headers, "Dev Date Executed");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = devDateExecuted;
              else updatedLastSyncedValues["Dev Date Executed"] = devDateExecuted;
            }
            if (devNotes !== undefined) {
              updatedLastSyncedValues.devNotes = devNotes;
              const colIdx = findHeaderIndex(headers, "Dev Notes");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = devNotes;
              else updatedLastSyncedValues["Dev Notes"] = devNotes;
            }
            if (qaStatus !== undefined) {
              updatedLastSyncedValues.qaStatus = qaStatus;
              const colIdx = findHeaderIndex(headers, "QA Status");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = qaStatus;
              else updatedLastSyncedValues["QA Status"] = qaStatus;
            }
            if (crossBrowserVerified !== undefined) {
              updatedLastSyncedValues.crossBrowserVerified = crossBrowserVerified;
              const colIdx = findHeaderIndex(headers, "cross browser Verfied ?");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = crossBrowserVerified;
              else updatedLastSyncedValues["cross browser Verfied ?"] = crossBrowserVerified;
            }
            if (priority !== undefined) {
              updatedLastSyncedValues.priority = priority;
              const colIdx = findHeaderIndex(headers, "Priority");
              if (colIdx !== -1) updatedLastSyncedValues[headers[colIdx]] = priority;
              else updatedLastSyncedValues["Priority"] = priority;
            }
          }

          docUpdates.lastSyncedValues = updatedLastSyncedValues;
        }

        batch.update(tcRef, docUpdates);
      }

      await batch.commit();
    }

    // Write audit logs
    if (syncSuccess) {
      await adminDb.collection("projects").doc(projectId).collection("audit_logs").add({
        user: userEmail,
        action: `Portal -> Sheet Sync: Updated ${idsToUpdate.length} test cases in bulk`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await adminDb.collection("projects").doc(projectId).collection("audit_logs").add({
        user: userEmail,
        action: `Bulk update logged in DB. Google Sheet sync status: FAILED (${syncErrorMsg})`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      synced: syncSuccess,
      syncError: syncErrorMsg || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE an individual test case and sync (remove row) with Google Sheet
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: projectId } = await params;

    if (!session?.user || !hasProjectAccess(session, projectId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email || "Unknown";
    
    // Parse testCaseId from query parameters
    const searchParams = req.nextUrl.searchParams;
    const testCaseId = searchParams.get("testCaseId");

    if (!testCaseId) {
      return NextResponse.json({ error: "Missing required query parameter: testCaseId" }, { status: 400 });
    }

    const projectRef = adminDb.collection("projects").doc(projectId);
    const tcRef = projectRef.collection("test_cases").doc(testCaseId);
    
    const tcSnap = await tcRef.get();
    if (!tcSnap.exists) {
      return NextResponse.json({ error: "Test Case not found" }, { status: 404 });
    }

    const projectSnap = await projectRef.get();
    const projectData = projectSnap.data() as any;
    const googleSheet = projectData.googleSheet;

    let syncSuccess = false;
    let syncErrorMsg = "";

    if (googleSheet && googleSheet.url) {
      try {
        const spreadsheetId = googleSheet.sheetId;
        const accessToken = await getGoogleAuthToken();
        const sheetMetadata = await getSpreadsheetSheetsMetadata(spreadsheetId, accessToken);
        
        if (sheetMetadata.length > 0) {
          const firstSheet = sheetMetadata[0];
          const rawRows = await getSheetValues(spreadsheetId, firstSheet.title, accessToken);
          
          if (rawRows.length > 0) {
            const headers = rawRows[0];
            let tcIdColIndex = findHeaderIndex(headers, "Test Case ID");
            if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "ID");
            if (tcIdColIndex === -1) tcIdColIndex = findHeaderIndex(headers, "TC ID");
            
            if (tcIdColIndex !== -1) {
              let rowNumber = -1;
              for (let i = 1; i < rawRows.length; i++) {
                if ((rawRows[i][tcIdColIndex] || "").trim() === testCaseId) {
                  rowNumber = i + 1; // 1-indexed
                  break;
                }
              }

              if (rowNumber !== -1) {
                await deleteSpreadsheetRow(spreadsheetId, firstSheet.sheetId, rowNumber, accessToken);
                syncSuccess = true;
              } else {
                syncErrorMsg = "Test Case ID not found in Google Sheet row.";
              }
            } else {
              syncErrorMsg = "Required column 'Test Case ID' missing in Google Sheet.";
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to sync deletion to Google Sheet:", err);
        syncErrorMsg = err.message || "Failed to contact Google Sheets API.";
      }
    }

    // Delete in Firestore
    await tcRef.delete();

    // Write audit logs
    await adminDb.collection("projects").doc(projectId).collection("audit_logs").add({
      user: userEmail,
      action: `Deleted test case ${testCaseId}. Google Sheet sync: ${syncSuccess ? "SUCCESS" : googleSheet?.url ? "FAILED (" + syncErrorMsg + ")" : "NONE"}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      synced: syncSuccess,
      syncError: syncErrorMsg || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

