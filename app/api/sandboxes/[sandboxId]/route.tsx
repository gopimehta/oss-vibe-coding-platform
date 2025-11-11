import { NextRequest, NextResponse } from "next/server";
import { E2BService } from "@/lib/e2b-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  try {
    const service = E2BService.getInstance();
    const instance = await service.getSandbox(sandboxId);
    
    if (instance && instance.sandbox) {
      return NextResponse.json({ status: "running" });
    }
    
    return NextResponse.json({ status: "stopped" });
  } catch (error) {
    console.error(`Error checking sandbox ${sandboxId}:`, error);
    return NextResponse.json({ status: "stopped" });
  }
}
