import { task } from "@trigger.dev/sdk/v3";
import { E2BService } from "@/lib/e2b-service";

export const createSandboxTask = task({
  id: "create-sandbox",
  run: async (payload: { timeout?: number; ports?: number[] } = {}) => {
    const service = E2BService.getInstance();
    const instance = await service.createSandbox({
      timeout: payload?.timeout,
      ports: payload?.ports,
    });

    return {
      sandboxId: instance.sandboxId,
      ports: instance.ports,
      timeout: instance.timeout,
    };
  },
});

export const runCommandTask = task({
  id: "run-command",
  run: async (
    payload: {
      sandboxId?: string;
      command?: string;
      args?: string[];
      sudo?: boolean;
      wait?: boolean;
    } = {}
  ) => {
    if (!payload?.sandboxId || !payload?.command) {
      return {
        cmdId: null,
        error:
          "sandboxId and command are required. Example: { sandboxId: 'sbx_xxx', command: 'npm', args: ['install'] }",
      };
    }

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

      return result;
    } catch (error) {
      return {
        cmdId: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const writeFilesTask = task({
  id: "write-files",
  run: async (
    payload: {
      sandboxId?: string;
      files?: Array<{ path: string; content: string }>;
    } = {}
  ) => {
    if (!payload?.sandboxId) {
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
      return {
        success: false,
        error: "files array is required and must not be empty",
      };
    }

    const service = E2BService.getInstance();
    try {
      await service.writeFiles(
        payload.sandboxId,
        payload.files.map((file) => ({
          path: file.path,
          content: Buffer.from(file.content, "utf8"),
        }))
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const getSandboxURLTask = task({
  id: "get-sandbox-url",
  run: async (payload: { sandboxId?: string; port?: number } = {}) => {
    if (!payload?.sandboxId || !payload?.port) {
      return {
        url: null,
        error:
          "sandboxId and port are required. Common ports: 3000 (Next.js), 8000 (Python), 5000 (Flask)",
      };
    }

    const service = E2BService.getInstance();
    try {
      const url = service.getSandboxURL(payload.sandboxId, payload.port);
      return { url };
    } catch (error) {
      return {
        url: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const getSandboxStatusTask = task({
  id: "get-sandbox-status",
  run: async (payload: { sandboxId?: string } = {}) => {
    if (!payload?.sandboxId) {
      return {
        status: "unknown",
        error: "sandboxId is required",
      };
    }

    try {
      const service = E2BService.getInstance();
      await service.getSandbox(payload.sandboxId);
      return { status: "running" };
    } catch (error) {
      return { status: "stopped" };
    }
  },
});
