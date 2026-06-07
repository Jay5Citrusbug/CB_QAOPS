import fs from "fs";
import path from "path";

// Load environment variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!process.env[key] || process.env[key].trim() === "") {
        process.env[key] = val;
      }
    });
    console.log("✅ Loaded environment variables.");
  } else {
    console.log("⚠️ .env file not found.");
  }
}

loadEnv();

import { getGoogleAuthToken } from "../lib/google-sheets";

async function runTest() {
  const spreadsheetId = "1SKjr5IEPF-8BheA_0ApUzLBImaPDZIQn9r4IsXf-Mr8";
  console.log(`Starting direct fetch test for spreadsheet ID: ${spreadsheetId}...`);

  try {
    const token = await getGoogleAuthToken();
    console.log("🔑 Obtained Google API token successfully.");

    console.log("Calling sheets API via fetch...");
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Response Status:", res.status);
    const body = await res.text();
    console.log("Response Body:", body);
  } catch (error: any) {
    console.error("❌ Test failed with error:", error);
  }
}

runTest();
