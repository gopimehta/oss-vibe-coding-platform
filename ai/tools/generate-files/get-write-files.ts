import type { DataPart } from "../../messages/data-parts";
import type { File } from "./get-contents";
import type { UIMessageStreamWriter, UIMessage } from "ai";
import { getRichError } from "../get-rich-error";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { writeFilesTask } from "@/trigger/sandbox";

interface Params {
  sandboxId: string;
  toolCallId: string;
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}

export function getWriteFiles({ sandboxId, toolCallId, writer }: Params) {
  return async function writeFiles(params: {
    written: string[];
    files: File[];
    paths: string[];
  }) {
    const paths = params.written.concat(params.files.map((file) => file.path));
    writer.write({
      id: toolCallId,
      type: "data-generating-files",
      data: { paths, status: "uploading" },
    });

    try {
      const handle = await tasks.trigger<typeof writeFilesTask>(
        "write-files",
        {
          sandboxId,
          files: params.files.map((file) => ({
            path: file.path,
            content: file.content,
          })),
        }
      );

      let run;
      do {
        run = await runs.retrieve(handle.id);
        if (run.status === "COMPLETED") {
          break;
        } else if (run.status === "FAILED" || run.status === "CRASHED") {
          throw new Error(run.error?.message || "Task failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      } while (true);

      if (!run.output) {
        throw new Error("Task completed but no output returned");
      }

      const output = run.output as { success: boolean; error?: string };

      if (!output.success) {
        throw new Error(output.error || "Failed to write files");
      }
    } catch (error) {
      
      const richError = getRichError({
        action: "write files to sandbox",
        args: params,
        error,
      });

      writer.write({
        id: toolCallId,
        type: "data-generating-files",
        data: {
          error: richError.error,
          status: "error",
          paths: params.paths,
        },
      });

      return richError.message;
    }

    writer.write({
      id: toolCallId,
      type: "data-generating-files",
      data: { paths, status: "uploaded" },
    });
  };
}
