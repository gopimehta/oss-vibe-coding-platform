import { NextResponse, type NextRequest } from "next/server";
import { E2BService } from "@/lib/e2b-service";
import z from "zod/v3";

const FileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;
  const fileParams = FileParamsSchema.safeParse({
    path: request.nextUrl.searchParams.get("path"),
    sandboxId,
  });

  if (fileParams.success === false) {
    return NextResponse.json(
      { error: "Invalid parameters. You must pass a `path` as query" },
      { status: 400 }
    );
  }

  try {
    const service = E2BService.getInstance();
    const stream = await service.readFile(
      fileParams.data.sandboxId,
      fileParams.data.path
    );

    return new NextResponse(
      new ReadableStream({
        async pull(controller) {
          try {
            const reader = stream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
            }
          } catch (error) {
            console.error("Error reading file:", error);
          } finally {
            controller.close();
          }
        },
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: "File not found in the Sandbox" },
      { status: 404 }
    );
  }
}
