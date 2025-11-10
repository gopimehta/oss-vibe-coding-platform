import { NextResponse, type NextRequest } from "next/server";
import { E2BService } from "@/lib/e2b-service";

interface Params {
  sandboxId: string;
  cmdId: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const logParams = await params;
  const encoder = new TextEncoder();
  const service = E2BService.getInstance();

  try {
    const logs = await service.getCommandLogs(logParams.cmdId);

    return new NextResponse(
      new ReadableStream({
        async pull(controller) {
          try {
            for await (const logline of logs) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    data: logline.data,
                    stream: logline.stream,
                    timestamp: Date.now(),
                  }) + "\n"
                )
              );
            }
          } catch (error) {
            console.error("Error streaming logs:", error);
          } finally {
            controller.close();
          }
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Command not found or logs unavailable" },
      { status: 404 }
    );
  }
}
