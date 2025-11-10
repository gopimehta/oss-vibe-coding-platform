import { NextRequest, NextResponse } from "next/server";
import { E2BService } from "@/lib/e2b-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  try {
    const service = E2BService.getInstance();
    await service.getSandbox(sandboxId);
    await service.runCommand(sandboxId, "echo", ["Sandbox status check"], {
      wait: true,
    });
    return NextResponse.json({ status: "running" });
  } catch (error) {
    return NextResponse.json({ status: "stopped" });
  }
}
