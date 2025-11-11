# OSS Vibe Coding Platform

An end-to-end coding platform where users can enter text prompts, and the AI agent will create full-stack applications.

**🌐 [Try the Live Demo](https://oss-vibe-coding-platform-six.vercel.app/)**

This project uses **Trigger.dev workflows** with **e2b sandboxes** for secure code execution, replacing the original Vercel Sandbox implementation while maintaining the same user experience.

## Architecture

### Overview

This platform combines the power of AI code generation with secure, isolated execution environments. The architecture is designed for reliability, observability, and scalability.

### Architecture Flow

```
User Input → AI Agent → AI Tools → Trigger.dev Tasks → E2B Service → e2b API
                                         ↓
                                   - Task Logging
                                   - Error Handling
                                   - Retry Logic
                                   - Observability
```

### Current Implementation

- **e2b sandboxes** for secure, isolated code execution
- **Trigger.dev** for workflow orchestration and task management
- All sandbox operations flow through Trigger.dev tasks
- Maintains the same user-facing API as the original

### Key Components

1. **Trigger.dev Workflows** (`trigger/sandbox.ts`): **Primary orchestration layer**

   - `createSandboxTask`: Creates new e2b sandboxes with full logging and error handling
   - `runCommandTask`: Executes commands in sandboxes with retry logic
   - `writeFilesTask`: Writes files to sandboxes with batch processing
   - `getSandboxURLTask`: Retrieves public URLs for sandbox services
   - `getSandboxStatusTask`: Checks sandbox status
   - **All tasks include:** comprehensive logging, error handling, run tracking, and observability

2. **AI Tools** (`ai/tools/`): AI agent tools that trigger Trigger.dev workflows

   - `create-sandbox.ts`: Triggers `createSandboxTask` for sandbox creation
   - `run-command.ts`: Triggers `runCommandTask` for command execution
   - `generate-files.ts`: Triggers `writeFilesTask` for file uploads
   - `get-sandbox-url.ts`: Triggers `getSandboxURLTask` for URL generation
   - **All tools use:** `tasks.trigger()` from `@trigger.dev/sdk/v3` to invoke workflows

3. **E2B Service** (`lib/e2b-service.ts`): Low-level service for e2b sandbox operations

   - Creates and manages sandbox lifecycles
   - Handles command execution with real-time output
   - Manages file operations (read/write)
   - Provides sandbox URL generation for port forwarding
   - **Called by:** Trigger.dev tasks (not directly by AI tools)

4. **API Routes** (`app/api/sandboxes/`): REST endpoints for sandbox operations
   - Status checking
   - Log streaming (real-time command output)
   - File reading

## Features

- 🤖 **AI-Powered Code Generation**: Generate full-stack applications from natural language prompts
- 🏗️ **Full-Stack Support**: Create Next.js apps, Go servers, Python applications, and more
- 🔒 **Secure Execution**: Code runs in isolated e2b sandboxes with full security
- 📊 **Real-Time Logs**: Stream command output and monitor execution in real-time
- 📁 **File Management**: Browse, read, and manage generated files through an intuitive file explorer
- 🔄 **Workflow Orchestration**: Robust task management with automatic retries and error handling via Trigger.dev
- 🌐 **Live Preview**: Preview your applications with automatic port forwarding

## Getting Started

### Prerequisites

- **Node.js 22.x** (see `engines` in `package.json`)
- **pnpm 8.15.4+** (or npm/yarn/bun)
- **e2b account** and API key ([Get one here](https://e2b.dev))
- **Trigger.dev account** and API key ([Get one here](https://trigger.dev))

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

**📖 See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions**, including:

- How to configure environment variables in both Vercel and Trigger.dev
- Step-by-step deployment guide
- Troubleshooting common issues

## Architecture Decisions

**e2b** provides secure, isolated sandbox environments with real-time output, port forwarding, and full filesystem access.

**Trigger.dev** orchestrates all sandbox operations with:

- Automatic retries (3 attempts by default)
- Comprehensive logging and run tracking
- Structured error handling
- Full observability through dashboard
- Scalability for concurrent operations

**Integration flow:** AI tools → Trigger.dev tasks → E2B service → e2b API

This architecture ensures robust, observable, and maintainable code execution workflows.

## Testing

See [TESTING.md](./TESTING.md) for detailed verification instructions. Quick check: After starting both dev servers, create a sandbox and verify tasks appear in the [Trigger.dev dashboard](https://cloud.trigger.dev).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [e2b Documentation](https://e2b.dev/docs)
- [Trigger.dev Documentation](https://trigger.dev/docs)
- [Original Vibe Coding Platform](https://oss-vibe-coding-platform.vercel.app/)
