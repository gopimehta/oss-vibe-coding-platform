import type { UIMessageStreamWriter, UIMessage } from "ai";
import type { DataPart } from "../messages/data-parts";
import { getRichError } from "./get-rich-error";
import { tool } from "ai";
import description from "./create-sandbox.md";
import z from "zod/v3";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { createSandboxTask } from "@/trigger/sandbox";

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}

export const createSandbox = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      timeout: z
        .number()
        .min(600000)
        .max(2700000)
        .optional()
        .describe(
          "Maximum time in milliseconds the e2b Sandbox will remain active before automatically shutting down. Minimum 600000ms (10 minutes), maximum 2700000ms (45 minutes). Defaults to 600000ms (10 minutes). The sandbox will terminate all running processes when this timeout is reached."
        ),
      ports: z
        .array(z.number())
        .max(2)
        .optional()
        .describe(
          "Array of network ports to expose and make accessible from outside the e2b Sandbox. These ports allow web servers, APIs, or other services running inside the e2b Sandbox to be reached externally. Common ports include 3000 (Next.js), 8000 (Python servers), 5000 (Flask), etc."
        ),
    }),
    execute: async ({ timeout, ports }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-create-sandbox",
        data: { status: "loading" },
      });

      try {
        const handle = await tasks.trigger<typeof createSandboxTask>(
          "create-sandbox",
          {
            timeout: timeout ?? 600000,
            ports,
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

        const output = run.output as {
          sandboxId: string;
          ports: number[];
          timeout: number;
        };

        writer.write({
          id: toolCallId,
          type: "data-create-sandbox",
          data: { sandboxId: output.sandboxId, status: "done" },
        });

        return (
          `Sandbox created with ID: ${output.sandboxId}.` +
          `\nYou can now upload files, run commands, and access services on the exposed ports.`
        );
      } catch (error) {
        const richError = getRichError({
          action: "Creating Sandbox",
          error,
        });

        writer.write({
          id: toolCallId,
          type: "data-create-sandbox",
          data: {
            error: { message: richError.error.message },
            status: "error",
          },
        });

        console.log("Error creating Sandbox:", richError.error);
        return richError.message;
      }
    },
  });
