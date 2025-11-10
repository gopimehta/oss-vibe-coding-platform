import { Sandbox } from "e2b";

export interface SandboxInstance {
  sandboxId: string;
  sandbox: Sandbox;
  ports: number[];
  timeout: number;
  createdAt: number;
}

const sandboxStore = new Map<string, SandboxInstance>();
const commandStore = new Map<string, any>();

export class E2BService {
  private static instance: E2BService;

  private constructor() {}

  static getInstance(): E2BService {
    if (!E2BService.instance) {
      E2BService.instance = new E2BService();
    }
    return E2BService.instance;
  }

  async createSandbox(options: {
    timeout?: number;
    ports?: number[];
  }): Promise<SandboxInstance> {
    const { timeout = 600000, ports = [] } = options;

    if (!process.env.E2B_API_KEY) {
      throw new Error("E2B_API_KEY environment variable is not set");
    }

    const sandbox = await Sandbox.create({
      template: "base",
      apiKey: process.env.E2B_API_KEY,
    });

    const instance: SandboxInstance = {
      sandboxId: sandbox.sandboxId,
      sandbox,
      ports,
      timeout,
      createdAt: Date.now(),
    };

    sandboxStore.set(sandbox.sandboxId, instance);

    setTimeout(async () => {
      try {
        await this.closeSandbox(sandbox.sandboxId);
      } catch (error) {
        console.error(`Error closing sandbox ${sandbox.sandboxId}:`, error);
      }
    }, timeout);

    return instance;
  }

  async getSandbox(sandboxId: string): Promise<SandboxInstance> {
    const instance = sandboxStore.get(sandboxId);
    if (!instance) {
      if (!process.env.E2B_API_KEY) {
        throw new Error("E2B_API_KEY environment variable is not set");
      }
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });
      const newInstance: SandboxInstance = {
        sandboxId,
        sandbox,
        ports: [],
        timeout: 600000,
        createdAt: Date.now(),
      };
      sandboxStore.set(sandboxId, newInstance);
      return newInstance;
    }
    return instance;
  }

  async closeSandbox(sandboxId: string): Promise<void> {
    const instance = sandboxStore.get(sandboxId);
    if (instance) {
      await instance.sandbox.close();
      sandboxStore.delete(sandboxId);
    }
  }

  async runCommand(
    sandboxId: string,
    command: string,
    args: string[] = [],
    options?: { sudo?: boolean; wait?: boolean }
  ): Promise<{
    cmdId: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
  }> {
    const instance = await this.getSandbox(sandboxId);

    const cmd = options?.sudo ? "sudo" : command;
    const cmdArgs = options?.sudo ? [command, ...args] : args;

    const exec = await instance.sandbox.process.start({
      cmd,
      args: cmdArgs,
    });

    commandStore.set(exec.processID, exec);

    if (options?.wait) {
      await exec.finished;
      
      let stdout = "";
      let stderr = "";
      
      try {
        for await (const chunk of exec.stdout) {
          stdout += chunk;
        }
      } catch (error) {
        console.error("Error reading stdout:", error);
      }
      
      try {
        for await (const chunk of exec.stderr) {
          stderr += chunk;
        }
      } catch (error) {
        console.error("Error reading stderr:", error);
      }

      return {
        cmdId: exec.processID,
        exitCode: exec.exitCode ?? 0,
        stdout: stdout,
        stderr: stderr,
      };
    } else {
      return {
        cmdId: exec.processID,
      };
    }
  }

  async getCommandLogs(cmdId: string): Promise<AsyncIterable<{ data: string; stream: "stdout" | "stderr" }>> {
    const exec = commandStore.get(cmdId);
    if (!exec) {
      throw new Error(`Command ${cmdId} not found`);
    }

    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const chunk of exec.stdout) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line) {
                yield { data: line, stream: "stdout" as const };
              }
            }
          }
        } catch (error) {
          console.error("Error streaming stdout:", error);
        }
        
        try {
          for await (const chunk of exec.stderr) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line) {
                yield { data: line, stream: "stderr" as const };
              }
            }
          }
        } catch (error) {
          console.error("Error streaming stderr:", error);
        }
      },
    };
  }

  async writeFiles(
    sandboxId: string,
    files: Array<{ path: string; content: Buffer }>
  ): Promise<void> {
    const instance = await this.getSandbox(sandboxId);
    await Promise.all(
      files.map((file) =>
        instance.sandbox.filesystem.write(file.path, file.content)
      )
    );
  }

  async readFile(sandboxId: string, path: string): Promise<ReadableStream> {
    const instance = await this.getSandbox(sandboxId);
    const content = await instance.sandbox.filesystem.read(path);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });
  }

  getSandboxURL(sandboxId: string, port: number): string {
    if (!sandboxId) {
      throw new Error("sandboxId is required");
    }
    if (!port || typeof port !== "number") {
      throw new Error("port is required and must be a number");
    }
    
    const instance = sandboxStore.get(sandboxId);
    if (!instance) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }
    
    try {
      const hostname = instance.sandbox.getHostname(port);
      return `https://${hostname}`;
    } catch (error) {
      console.warn("Could not get hostname from sandbox, using fallback URL:", error);
      return `https://${sandboxId}-${port}.e2b.dev`;
    }
  }
}

