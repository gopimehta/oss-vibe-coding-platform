import type { UIMessageStreamWriter, UIMessage } from "ai";
import type { DataPart } from "../messages/data-parts";
import { getRichError } from "./get-rich-error";
import { tool } from "ai";
import description from "./get-sandbox-url.md";
import z from "zod/v3";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { getSandboxURLTask } from "@/trigger/sandbox";

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}

export const getSandboxURL = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: z
        .string()
        .describe(
          "The unique identifier of the e2b Sandbox (e.g., 'sbx_abc123xyz'). This ID is returned when creating an e2b Sandbox and is used to reference the specific sandbox instance."
        ),
      port: z
        .number()
        .describe(
          "The port number where a service is running inside the e2b Sandbox (e.g., 3000 for Next.js dev server, 8000 for Python apps, 5000 for Flask). The port must have been exposed when the sandbox was created or when running commands."
        ),
    }),
    execute: async ({ sandboxId, port }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-get-sandbox-url",
        data: { status: "loading" },
      });

      try {
        const handle = await tasks.trigger<typeof getSandboxURLTask>(
          "get-sandbox-url",
          {
            sandboxId,
            port,
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

        const output = run.output as { url: string | null; error?: string };

        if (output.error) {
          throw new Error(output.error);
        }

        if (!output.url) {
          throw new Error("Failed to get sandbox URL");
        }

        writer.write({
          id: toolCallId,
          type: "data-get-sandbox-url",
          data: { url: output.url, status: "done" },
        });

        return { url: output.url };
      } catch (error) {
        const richError = getRichError({
          action: "get sandbox URL",
          args: { sandboxId, port },
          error,
        });

        writer.write({
          id: toolCallId,
          type: "data-get-sandbox-url",
          data: {
            error: { message: richError.error.message },
            status: "error",
          },
        });

        console.log("Error getting sandbox URL:", richError.error);
        return richError.message;
      }
    },
  });
