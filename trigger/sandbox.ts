import { task, logger } from "@trigger.dev/sdk/v3";
import { E2BService } from "@/lib/e2b-service";

/**
 * Task to create a new e2b sandbox instance
 * This task is orchestrated by Trigger.dev and manages the lifecycle of sandbox creation
 */
export const createSandboxTask = task({
  id: "create-sandbox",
  run: async (payload: { timeout?: number; ports?: number[] } = {}, { ctx }) => {
    logger.info("Creating new e2b sandbox", { 
      timeout: payload?.timeout, 
      ports: payload?.ports,
      runId: ctx.run.id 
    });

    try {
      const service = E2BService.getInstance();
      const instance = await service.createSandbox({
        timeout: payload?.timeout,
        ports: payload?.ports,
      });

      logger.info("Successfully created e2b sandbox", {
        sandboxId: instance.sandboxId,
        ports: instance.ports,
        timeout: instance.timeout,
        runId: ctx.run.id
      });

      return {
        sandboxId: instance.sandboxId,
        ports: instance.ports,
        timeout: instance.timeout,
      };
    } catch (error) {
      logger.error("Failed to create e2b sandbox", { 
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.run.id
      });
      throw error;
    }
  },
});

/**
 * Task to run a command in an existing e2b sandbox
 * Supports both synchronous (wait=true) and asynchronous (wait=false) execution
 * Real-time output is captured and can be streamed via the command logs API
 */
export const runCommandTask = task({
  id: "run-command",
  run: async (
    payload: {
      sandboxId?: string;
      command?: string;
      args?: string[];
      sudo?: boolean;
      wait?: boolean;
    } = {},
    { ctx }
  ) => {
    if (!payload?.sandboxId || !payload?.command) {
      logger.error("Missing required parameters for run-command task", { 
        payload,
        runId: ctx.run.id 
      });
      return {
        cmdId: null,
        error:
          "sandboxId and command are required. Example: { sandboxId: 'sbx_xxx', command: 'npm', args: ['install'] }",
      };
    }

    logger.info("Running command in sandbox", {
      sandboxId: payload.sandboxId,
      command: payload.command,
      args: payload.args,
      sudo: payload.sudo,
      wait: payload.wait,
      runId: ctx.run.id
    });

    const service = E2BService.getInstance();
    try {
      const result = await service.runCommand(
        payload.sandboxId,
        payload.command,
        payload.args || [],
        {
          sudo: payload.sudo,
          wait: payload.wait,
        }
      );

      logger.info("Command execution completed", {
        sandboxId: payload.sandboxId,
        command: payload.command,
        cmdId: result.cmdId,
        exitCode: result.exitCode,
        wait: payload.wait,
        runId: ctx.run.id
      });

      return result;
    } catch (error) {
      logger.error("Command execution failed", {
        sandboxId: payload.sandboxId,
        command: payload.command,
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.run.id
      });
      return {
        cmdId: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Task to write multiple files to an e2b sandbox
 * Handles batch file uploads with proper error handling
 */
export const writeFilesTask = task({
  id: "write-files",
  run: async (
    payload: {
      sandboxId?: string;
      files?: Array<{ path: string; content: string }>;
    } = {},
    { ctx }
  ) => {
    if (!payload?.sandboxId) {
      logger.error("Missing sandboxId for write-files task", { 
        runId: ctx.run.id 
      });
      return {
        success: false,
        error: "sandboxId is required",
      };
    }
    if (
      !payload?.files ||
      !Array.isArray(payload.files) ||
      payload.files.length === 0
    ) {
      logger.error("Missing or empty files array", { 
        sandboxId: payload.sandboxId,
        runId: ctx.run.id 
      });
      return {
        success: false,
        error: "files array is required and must not be empty",
      };
    }

    logger.info("Writing files to sandbox", {
      sandboxId: payload.sandboxId,
      fileCount: payload.files.length,
      filePaths: payload.files.map((f) => f.path),
      runId: ctx.run.id
    });

    const service = E2BService.getInstance();
    try {
      await service.writeFiles(
        payload.sandboxId,
        payload.files.map((file) => ({
          path: file.path,
          content: Buffer.from(file.content, "utf8"),
        }))
      );

      logger.info("Successfully wrote files to sandbox", {
        sandboxId: payload.sandboxId,
        fileCount: payload.files.length,
        runId: ctx.run.id
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to write files to sandbox", {
        sandboxId: payload.sandboxId,
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.run.id
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Task to get the public URL for a service running in an e2b sandbox
 * Returns a URL that can be used to access the service from the internet
 */
export const getSandboxURLTask = task({
  id: "get-sandbox-url",
  run: async (payload: { sandboxId?: string; port?: number } = {}, { ctx }) => {
    if (!payload?.sandboxId || !payload?.port) {
      logger.error("Missing required parameters for get-sandbox-url task", { 
        payload,
        runId: ctx.run.id 
      });
      return {
        url: null,
        error:
          "sandboxId and port are required. Common ports: 3000 (Next.js), 8000 (Python), 5000 (Flask)",
      };
    }

    logger.info("Getting sandbox URL", {
      sandboxId: payload.sandboxId,
      port: payload.port,
      runId: ctx.run.id
    });

    const service = E2BService.getInstance();
    try {
      const url = await service.getSandboxURL(payload.sandboxId, payload.port);
      
      logger.info("Successfully retrieved sandbox URL", {
        sandboxId: payload.sandboxId,
        port: payload.port,
        url,
        runId: ctx.run.id
      });
      
      return { url };
    } catch (error) {
      logger.error("Failed to get sandbox URL", {
        sandboxId: payload.sandboxId,
        port: payload.port,
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.run.id
      });
      return {
        url: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Task to check the status of an e2b sandbox
 * Returns whether the sandbox is running or stopped
 */
export const getSandboxStatusTask = task({
  id: "get-sandbox-status",
  run: async (payload: { sandboxId?: string } = {}, { ctx }) => {
    if (!payload?.sandboxId) {
      logger.error("Missing sandboxId for get-sandbox-status task", { 
        runId: ctx.run.id 
      });
      return {
        status: "unknown",
        error: "sandboxId is required",
      };
    }

    logger.info("Checking sandbox status", {
      sandboxId: payload.sandboxId,
      runId: ctx.run.id
    });

    try {
      const service = E2BService.getInstance();
      await service.getSandbox(payload.sandboxId);
      
      logger.info("Sandbox is running", {
        sandboxId: payload.sandboxId,
        runId: ctx.run.id
      });
      
      return { status: "running" };
    } catch (error) {
      logger.warn("Sandbox is not running", {
        sandboxId: payload.sandboxId,
        error: error instanceof Error ? error.message : String(error),
        runId: ctx.run.id
      });
      return { status: "stopped" };
    }
  },
});
