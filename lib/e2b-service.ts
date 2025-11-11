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

  private getFilesystemAPI(sandbox: any) {
    return sandbox?.filesystem ?? sandbox?.fs ?? sandbox?.fileSystem ?? null;
  }

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

    const sandbox = await Sandbox.create("base", {
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: timeout,
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
      try {
        let sandbox;
        try {
          sandbox = await Sandbox.connect(sandboxId, {
            apiKey: process.env.E2B_API_KEY,
          });
        } catch (connectError) {
          const errorMsg =
            connectError instanceof Error
              ? connectError.message
              : String(connectError);
          if (
            errorMsg.includes("paused") ||
            errorMsg.includes("Paused") ||
            errorMsg.includes("not found")
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
              sandbox = await Sandbox.connect(sandboxId, {
                apiKey: process.env.E2B_API_KEY,
              });
            } catch (retryError) {
              const retryErrorMsg =
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError);
              if (
                retryErrorMsg.includes("paused") ||
                retryErrorMsg.includes("Paused") ||
                retryErrorMsg.includes("not found")
              ) {
                throw new Error(
                  `Sandbox ${sandboxId} is paused or has been terminated. Please create a new sandbox.`
                );
              }
              throw retryError;
            }
          } else {
            throw connectError;
          }
        }

        if (!sandbox) {
          throw new Error(
            `Failed to connect to sandbox ${sandboxId} - sandbox object is null`
          );
        }

        const commandsAPI = (sandbox as any).commands;
        if (!commandsAPI) {
          throw new Error(
            `Failed to connect to sandbox ${sandboxId} - commands API not available. The sandbox may have been closed.`
          );
        }

        const maxWaitSeconds = 5;
        let fsApiFound = false;
        for (let i = 0; i < maxWaitSeconds; i++) {
          const fsApi = this.getFilesystemAPI(sandbox);
          if (fsApi) {
            fsApiFound = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const newInstance: SandboxInstance = {
          sandboxId,
          sandbox,
          ports: [],
          timeout: 600000,
          createdAt: Date.now(),
        };
        sandboxStore.set(sandboxId, newInstance);
        return newInstance;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Error connecting to sandbox ${sandboxId}:`,
          errorMessage
        );
        throw new Error(
          `Failed to connect to sandbox ${sandboxId}: ${errorMessage}`
        );
      }
    }

    if (!instance.sandbox || !(instance.sandbox as any).commands) {
      sandboxStore.delete(sandboxId);
      return this.getSandbox(sandboxId);
    }

    return instance;
  }

  async closeSandbox(sandboxId: string): Promise<void> {
    const instance = sandboxStore.get(sandboxId);
    if (instance) {
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

    if (!instance || !instance.sandbox) {
      throw new Error(`Sandbox ${sandboxId} instance is invalid`);
    }

    if (!(instance.sandbox as any).commands) {
      throw new Error(
        `Sandbox ${sandboxId} commands API is not available. The sandbox may have been closed or is not properly connected.`
      );
    }

    const cmdParts = [];
    if (options?.sudo) {
      cmdParts.push("sudo", command, ...args);
    } else {
      cmdParts.push(command, ...args);
    }
    const fullCommand = cmdParts.join(" ");

    let exec;
    try {
      exec = await (instance.sandbox as any).commands.run(fullCommand, {
        wait: options?.wait ?? false,
      });

      if (!exec) {
        throw new Error(
          `e2b commands.run() returned null/undefined for command: ${fullCommand}`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("exit status") && options?.wait) {
        const exitCodeMatch = errorMsg.match(/exit status (\d+)/);
        const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : 1;
        exec = {
          exitCode: exitCode,
          stdout: "",
          stderr: errorMsg,
          error: errorMsg,
        };
      } else {
        throw error;
      }
    }

    if (options?.wait) {
      const result = exec;

      const cmdId = `cmd_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      commandStore.set(cmdId, result);

      const exitCode = result.exitCode ?? 0;
      const hasExitStatusError =
        result.error && result.error.includes("exit status");

      const error = hasExitStatusError ? undefined : result.error;

      return {
        cmdId: cmdId,
        exitCode: exitCode,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    } else {
      if (!exec || typeof exec !== "object") {
        throw new Error(
          `Command execution failed - invalid result returned from e2b API`
        );
      }

      const cmdId =
        exec.processID ||
        exec.id ||
        exec.cmdId ||
        exec.commandId ||
        (exec as any).pid;

      if (!cmdId) {
        const generatedId = `cmd_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        commandStore.set(generatedId, exec);
        return {
          cmdId: generatedId,
        };
      }

      commandStore.set(cmdId, exec);
      return {
        cmdId: cmdId,
      };
    }
  }

  async getCommandLogs(
    cmdId: string
  ): Promise<AsyncIterable<{ data: string; stream: "stdout" | "stderr" }>> {
    const exec = commandStore.get(cmdId);
    if (!exec) {
      throw new Error(`Command ${cmdId} not found`);
    }

    return {
      async *[Symbol.asyncIterator]() {
        if (exec.stdout) {
          try {
            if (typeof exec.stdout === "string") {
              const lines = exec.stdout.split("\n");
              for (const line of lines) {
                if (line) {
                  yield { data: line, stream: "stdout" as const };
                }
              }
            } else {
              for await (const chunk of exec.stdout) {
                const lines = chunk.split("\n");
                for (const line of lines) {
                  if (line) {
                    yield { data: line, stream: "stdout" as const };
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error streaming stdout:", error);
          }
        }

        if (exec.stderr) {
          try {
            if (typeof exec.stderr === "string") {
              const lines = exec.stderr.split("\n");
              for (const line of lines) {
                if (line) {
                  yield { data: line, stream: "stderr" as const };
                }
              }
            } else {
              for await (const chunk of exec.stderr) {
                const lines = chunk.split("\n");
                for (const line of lines) {
                  if (line) {
                    yield { data: line, stream: "stderr" as const };
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error streaming stderr:", error);
          }
        }
      },
    };
  }

  private async writeFileViaCommand(
    instance: SandboxInstance,
    file: { path: string; content: Buffer }
  ): Promise<void> {
    const dir = file.path.substring(0, file.path.lastIndexOf("/"));
    if (dir) {
      const mkdirResult = await (instance.sandbox as any).commands.run(
        `mkdir -p "${dir}"`,
        { wait: true }
      );
      if (mkdirResult.exitCode !== 0) {
        console.warn(
          `Warning: mkdir failed for ${dir}: ${mkdirResult.stderr || mkdirResult.error}`
        );
      }
    }

    const base64Content = file.content.toString("base64");
    const escapedPath = file.path.replace(/"/g, '\\"');
    const tempFile = `/tmp/e2b_write_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const chunkSize = 50000;
    const chunks = [];
    for (let i = 0; i < base64Content.length; i += chunkSize) {
      chunks.push(base64Content.substring(i, i + chunkSize));
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const appendOp = i === 0 ? ">" : ">>";
      const writeCmd = `printf '%s' "${chunk}" ${appendOp} "${tempFile}"`;
      const writeResult = await (instance.sandbox as any).commands.run(writeCmd, {
        wait: true,
      });
      if (writeResult.exitCode !== 0) {
        await (instance.sandbox as any).commands.run(`rm -f "${tempFile}"`, {
          wait: true,
        });
        throw new Error(
          `Failed to write chunk ${i + 1}/${chunks.length}: ${writeResult.stderr || writeResult.error || 'Unknown error'}`
        );
      }
    }
    
    const decodeCmd = `base64 -d "${tempFile}" > "${escapedPath}"`;
    const result = await (instance.sandbox as any).commands.run(decodeCmd, {
      wait: true,
    });
    
    await (instance.sandbox as any).commands.run(`rm -f "${tempFile}"`, {
      wait: true,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to write file via command: ${result.stderr || result.error || 'Unknown error'}`
      );
    }
  }

  async writeFiles(
    sandboxId: string,
    files: Array<{ path: string; content: Buffer }>
  ): Promise<void> {
    const instance = await this.getSandbox(sandboxId);
    const fsApi = this.getFilesystemAPI(instance.sandbox as any);
    
    if (!fsApi) {
      try {
        for (const file of files) {
          await this.writeFileViaCommand(instance, file);
        }
        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to write files via command-line: ${errorMessage}`
        );
      }
    }

    try {
      await Promise.all(
        files.map(async (file) => {
          try {
            const filesystem = this.getFilesystemAPI(instance.sandbox as any);
            const writeFn =
              typeof filesystem.write === "function"
                ? filesystem.write.bind(filesystem)
                : typeof filesystem.writeFile === "function"
                ? filesystem.writeFile.bind(filesystem)
                : null;
            if (!writeFn) {
              throw new Error(
                `No supported write method found on filesystem. Available methods: ${Object.keys(
                  filesystem
                ).join(", ")}`
              );
            }

            try {
              await writeFn(file.path, file.content);
            } catch (bufferError) {
              await writeFn(file.path, file.content.toString("utf8"));
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to write file ${file.path}: ${errorMsg}`);
          }
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write files to sandbox: ${errorMessage}`);
    }
  }

  async readFile(sandboxId: string, path: string): Promise<ReadableStream> {
    const instance = await this.getSandbox(sandboxId);
    const fsApi = this.getFilesystemAPI(instance.sandbox as any);
    
    if (!fsApi) {
      const escapedPath = path.replace(/"/g, '\\"');
      const result = await (instance.sandbox as any).commands.run(
        `cat "${escapedPath}"`,
        { wait: true }
      );
      
      if (result.exitCode !== 0) {
        throw new Error(
          `File not found or cannot be read: ${result.stderr || result.error || 'Unknown error'}`
        );
      }
      
      const content = result.stdout || "";
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content));
          controller.close();
        },
      });
    }
    
    const readFn =
      typeof fsApi.read === "function"
        ? fsApi.read.bind(fsApi)
        : typeof fsApi.readFile === "function"
        ? fsApi.readFile.bind(fsApi)
        : null;
    if (!readFn) {
      throw new Error(
        `No supported read method found on filesystem. Available methods: ${Object.keys(
          fsApi
        ).join(", ")}`
      );
    }
    const content = await readFn(path);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });
  }

  async getSandboxURL(sandboxId: string, port: number): Promise<string> {
    if (!sandboxId) {
      throw new Error("sandboxId is required");
    }
    if (!port || typeof port !== "number") {
      throw new Error("port is required and must be a number");
    }

    const instance = await this.getSandbox(sandboxId);

    try {
      const hostname = (instance.sandbox as any).getHostname(port);
      return `https://${hostname}`;
    } catch (error) {
      return `https://${sandboxId}-${port}.e2b.dev`;
    }
  }
}
