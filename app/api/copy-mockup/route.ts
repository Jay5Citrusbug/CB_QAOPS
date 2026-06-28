import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const src = "C:/Users/Jay/.gemini/config/../antigravity-ide/brain/73ca5ddd-77b3-408b-acb2-076945795348/media__1782577572063.png";
    const dest = "d:/Automation/Playwright/CB QOps/public/logo.png";
    
    // Ensure the public directory exists
    const publicDir = path.dirname(dest);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.copyFileSync(src, dest);
    return NextResponse.json({ success: true, message: "Logo copied successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
