import crypto from "crypto";

interface JwtPayload {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Extracts spreadsheet ID from a Google Sheet URL.
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Generates an OAuth 2.0 access token using the Firebase Service Account private key.
 */
export async function getGoogleAuthToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing Google Service Account credentials (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY) in .env file.");
  }

  // Handle escaped newlines in .env
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  const signature = signer.sign(privateKey, "base64url");

  const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth API token request failed: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Fetches sheet names from a Google Spreadsheet.
 */
export async function getSpreadsheetSheets(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Google Sheets API Request Failed. Status:", res.status, "Response:", errText);

    let isApiDisabled = false;
    try {
      const parsed = JSON.parse(errText);
      const msg = parsed.error?.message || "";
      if (msg.toLowerCase().includes("disabled") || msg.toLowerCase().includes("not been used")) {
        isApiDisabled = true;
      }
    } catch {
      if (errText.toLowerCase().includes("disabled") || errText.toLowerCase().includes("not been used")) {
        isApiDisabled = true;
      }
    }

    if (isApiDisabled) {
      throw new Error("API_DISABLED");
    }

    if (res.status === 403) {
      throw new Error("PERMISSION_DENIED");
    }
    if (res.status === 404) {
      throw new Error("NOT_FOUND");
    }
    throw new Error(`Failed to fetch spreadsheet metadata: ${errText}`);
  }

  const data = await res.json();
  return data.sheets.map((s: any) => s.properties.title);
}

/**
 * Fetches all row values of a given sheet in a spreadsheet.
 */
export async function getSheetValues(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetName}!A1:Z5000`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch values from sheet "${sheetName}": ${errText}`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Interface representing a batch cell value update.
 */
export interface CellUpdate {
  range: string; // e.g. Sheet1!A2:Z2
  values: any[][];
}

/**
 * Updates multiple ranges in a spreadsheet in a single batch.
 */
export async function updateSheetValuesBatch(
  spreadsheetId: string,
  updates: CellUpdate[],
  accessToken: string
): Promise<void> {
  if (updates.length === 0) return;

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: updates,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update Google Sheet values in batch: ${errText}`);
  }
}

/**
 * Helper to match column headers case-insensitively and space-insensitively.
 */
export function findHeaderIndex(headers: string[], target: string): number {
  const normalize = (s: string) => {
    if (!s) return "";
    let res = s.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
    if (res === "crossbrowserverfied" || res === "crossbrowserverified") {
      return "crossbrowserverified";
    }
    return res;
  };
  
  const normTarget = normalize(target);
  return headers.findIndex(h => normalize(h) === normTarget);
}

