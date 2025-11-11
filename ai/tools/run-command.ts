import type { UIMessageStreamWriter, UIMessage } from "ai";
import type { DataPart } from "../messages/data-parts";
import { getRichError } from "./get-rich-error";
import { tool } from "ai";
import description from "./run-command.md";
import z from "zod/v3";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { runCommandTask } from "@/trigger/sandbox";

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}

export const runCommand = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: z
        .string()
        .describe("The ID of the e2b Sandbox to run the command in"),
      command: z
        .string()
        .describe(
          "The base command to run (e.g., 'npm', 'node', 'python', 'ls', 'cat'). Do NOT include arguments here. IMPORTANT: Each command runs independently in a fresh shell session - there is no persistent state between commands. You cannot use 'cd' to change directories for subsequent commands."
        ),
      args: z
        .array(z.string())
        .optional()
        .describe(
          "Array of arguments for the command. Each argument should be a separate string (e.g., ['install', '--verbose'] for npm install --verbose, or ['src/index.js'] to run a file, or ['-la', './src'] to list files). IMPORTANT: Use relative paths (e.g., 'src/file.js') or absolute paths instead of trying to change directories with 'cd' first, since each command runs in a fresh shell session."
        ),
      sudo: z
        .boolean()
        .optional()
        .describe("Whether to run the command with sudo"),
      wait: z
        .boolean()
        .describe(
          "Whether to wait for the command to finish before returning. If true, the command will block until it completes, and you will receive its output."
        ),
    }),
    execute: async (
      { sandboxId, command, sudo, wait, args },
      { toolCallId }
    ) => {
      const normalizedArgs = Array.isArray(args) ? args : (args ? [String(args)] : []);
      
      writer.write({
        id: toolCallId,
        type: "data-run-command",
        data: { sandboxId, command, args: normalizedArgs, status: "executing" },
      });

      try {
        const handle = await tasks.trigger<typeof runCommandTask>(
          "run-command",
          {
            sandboxId,
            command,
            args: normalizedArgs,
            sudo,
            wait,
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
          cmdId: string | null;
          exitCode?: number;
          stdout?: string;
          stderr?: string;
          error?: string;
        };

        if (output.error && !output.cmdId && !output.error.includes('exit status')) {
          throw new Error(output.error);
        }

        if (!output.cmdId) {
          throw new Error("Failed to start command - no command ID returned");
        }

        writer.write({
          id: toolCallId,
          type: "data-run-command",
          data: {
            sandboxId,
            commandId: output.cmdId,
            command,
            args: normalizedArgs,
            status: "executing",
          },
        });

        if (!wait) {
          writer.write({
            id: toolCallId,
            type: "data-run-command",
            data: {
              sandboxId,
              commandId: output.cmdId,
              command,
              args: normalizedArgs,
              status: "running",
            },
          });

          return `The command \`${command} ${normalizedArgs.join(
            " "
          )}\` has been started in the background in the sandbox with ID \`${sandboxId}\` with the commandId ${
            output.cmdId
          }.`;
        }

        writer.write({
          id: toolCallId,
          type: "data-run-command",
          data: {
            sandboxId,
            commandId: output.cmdId,
            command,
            args: normalizedArgs,
            status: "waiting",
          },
        });

        writer.write({
          id: toolCallId,
          type: "data-run-command",
          data: {
            sandboxId,
            commandId: output.cmdId,
            command,
            args: normalizedArgs,
            exitCode: output.exitCode ?? 0,
            status: "done",
          },
        });

        return (
          `The command \`${command} ${normalizedArgs.join(
            " "
          )}\` has finished with exit code ${output.exitCode ?? 0}.` +
          (output.stdout
            ? `\nStdout of the command was: \n\`\`\`\n${output.stdout}\n\`\`\`\n`
            : "") +
          (output.stderr
            ? `Stderr of the command was: \n\`\`\`\n${output.stderr}\n\`\`\``
            : "")
        );
      } catch (error) {
        const richError = getRichError({
          action: "run command in sandbox",
          args: { sandboxId, command, args: normalizedArgs },
          error,
        });

        writer.write({
          id: toolCallId,
          type: "data-run-command",
          data: {
            sandboxId,
            command,
            args: normalizedArgs,
            error: richError.error,
            status: "error",
          },
        });

        console.log("Error running command:", richError.error);
        return richError.message;
      }
    },
  });
