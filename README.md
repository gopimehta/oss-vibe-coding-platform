# OSS Vibe Coding Platform

This is a **demo** of an end-to-end coding platform where the user can enter text prompts, and the agent will create a full stack application.

This project has been modified to use **Trigger.dev workflows** with **e2b sandboxes** instead of Vercel Sandbox for code execution, while maintaining the same user experience as the original Vibe Code demo.

## Architecture

### Original Implementation

- Used **Vercel Sandbox** for secure code execution
- Direct SDK integration for sandbox management

### Current Implementation

- Uses **e2b sandboxes** for secure, isolated code execution environments
- Uses **Trigger.dev** for workflow orchestration and task management
- Maintains the same user-facing API and experience

### Key Components

1. **E2B Service** (`lib/e2b-service.ts`): Singleton service that manages e2b sandbox instances

   - Creates and manages sandbox lifecycles
   - Handles command execution with real-time output
   - Manages file operations (read/write)
   - Provides sandbox URL generation for port forwarding

2. **Trigger.dev Workflows** (`trigger/sandbox.ts`): Background tasks for sandbox operations

   - `createSandboxTask`: Creates new e2b sandboxes
   - `runCommandTask`: Executes commands in sandboxes
   - `writeFilesTask`: Writes files to sandboxes
   - `getSandboxURLTask`: Retrieves public URLs for sandbox services
   - `getSandboxStatusTask`: Checks sandbox status

3. **AI Tools** (`ai/tools/`): AI agent tools that interface with the sandbox

   - `create-sandbox.ts`: Tool for creating new sandboxes
   - `run-command.ts`: Tool for executing commands
   - `generate-files.ts`: Tool for generating and uploading files
   - `get-sandbox-url.ts`: Tool for getting public URLs

4. **API Routes** (`app/api/sandboxes/`): REST endpoints for sandbox operations
   - Status checking
   - Log streaming
   - File reading

## Getting Started

### Prerequisites

- Node.js 22.x (see `engines` in `package.json`)
- pnpm 8.15.4+ (or npm/yarn/bun)
- e2b account and API key ([Get one here](https://e2b.dev))
- Trigger.dev account and API key ([Get one here](https://trigger.dev))

### Environment Variables

Create a `.env.local` file in the root directory with the following required environment variables:

```bash
# Required: API key for authenticating with the AI Gateway
AI_GATEWAY_API_KEY=your_api_key_here

# Required: e2b API key for sandbox execution
E2B_API_KEY=your_e2b_api_key_here

# Required: Trigger.dev API key for workflow orchestration
TRIGGER_SECRET_KEY=your_TRIGGER_SECRET_KEY_here

# Optional: Trigger.dev project ID (will be set during trigger.dev init)
# TRIGGER_PROJECT_ID=proj_xxxxx

# Optional: Custom base URL for the AI Gateway
# AI_GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1
```

### Installation

1. Install dependencies:

```bash
pnpm install
# or
npm install
```

2. Initialize Trigger.dev (if not already done):

```bash
npx trigger.dev@latest init
```

This will:

- Create/update `trigger.config.ts`
- Set up the Trigger.dev project
- Guide you through authentication

### Development

1. **Start the Next.js development server:**

```bash
pnpm dev
# or
npm run dev
```

2. **Start the Trigger.dev development server** (in a separate terminal):

```bash
pnpm trigger:dev
# or
npm run trigger:dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Deployment

1. **Deploy Trigger.dev workflows:**

```bash
pnpm trigger:deploy
# or
npm run trigger:deploy
```

2. **Deploy the Next.js application:**

The application can be deployed to Vercel, or any other Next.js-compatible platform. Make sure to set all environment variables in your deployment platform.

## Architecture Decisions

### Why e2b?

- **Secure Execution**: e2b provides isolated, secure sandbox environments for code execution
- **Real-time Output**: Supports streaming logs and real-time command output
- **Port Forwarding**: Built-in support for exposing services running in sandboxes
- **File System**: Full filesystem access for reading and writing files

### Why Trigger.dev?

- **Workflow Orchestration**: Manages complex, long-running operations
- **Error Handling**: Built-in retry logic and error handling
- **Observability**: Provides visibility into task execution and status
- **Scalability**: Handles background tasks efficiently

### Why Both?

- **e2b** handles the actual code execution and sandbox management (synchronous operations)
- **Trigger.dev** handles workflow orchestration and background tasks (asynchronous operations)
- This hybrid approach provides the best of both worlds: real-time UX with robust background processing

## Manual Setup Steps

1. **Get API Keys:**

   - Sign up for [e2b](https://e2b.dev) and get your API key
   - Sign up for [Trigger.dev](https://trigger.dev) and get your API key

2. **Configure Environment Variables:**

   - Add `E2B_API_KEY` to `.env.local`
   - Add `TRIGGER_SECRET_KEY` to `.env.local`
   - Add `AI_GATEWAY_API_KEY` to `.env.local` (if using AI Gateway)

3. **Initialize Trigger.dev:**

   - Run `npx trigger.dev@latest init`
   - Follow the prompts to authenticate and set up your project

4. **Deploy Workflows:**
   - Run `pnpm trigger:deploy` to deploy Trigger.dev workflows

## Differences from Original

- **Sandbox Provider**: Changed from Vercel Sandbox to e2b
- **Workflow Management**: Added Trigger.dev for orchestration
- **Service Layer**: Introduced `E2BService` singleton for sandbox management
- **API Compatibility**: Maintained the same API surface for tools and routes

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [e2b Documentation](https://e2b.dev/docs)
- [Trigger.dev Documentation](https://trigger.dev/docs)
- [Original Vibe Coding Platform](https://oss-vibe-coding-platform.vercel.app/)
