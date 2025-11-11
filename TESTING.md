# Testing the Trigger.dev Integration

This document outlines how to verify that Trigger.dev is properly integrated and orchestrating all sandbox operations.

## Prerequisites

1. Set up environment variables in `.env.local`:

   ```bash
   E2B_API_KEY=your_e2b_api_key
   TRIGGER_SECRET_KEY=your_trigger_secret_key
   AI_GATEWAY_API_KEY=your_ai_gateway_key
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Initialize Trigger.dev:
   ```bash
   npx trigger.dev@latest init
   ```

## Running the Tests

### 1. Start the Development Servers

Open two terminal windows:

**Terminal 1 - Next.js Server:**

```bash
pnpm dev
```

**Terminal 2 - Trigger.dev Dev Server:**

```bash
pnpm trigger:dev
```

The Trigger.dev dev server will display all task executions in real-time, allowing you to verify that tasks are being triggered.

### 2. Test Sandbox Creation

1. Open http://localhost:3000 in your browser
2. Start a new chat and ask the AI: "Create a sandbox"
3. Watch Terminal 2 (Trigger.dev) for logs showing:
   - `[create-sandbox]` task being triggered
   - Execution progress with run ID
   - Successful sandbox creation with sandbox ID

**Expected Output in Trigger.dev Console:**

```
✓ create-sandbox started
  Creating new e2b sandbox
✓ Successfully created e2b sandbox (sandboxId: sbx_xxxxx)
✓ create-sandbox completed
```

### 3. Test Command Execution

1. In the same chat, ask: "Run npm init -y in the sandbox"
2. Watch Terminal 2 for:
   - `[run-command]` task being triggered
   - Command execution logs
   - Exit code and output

**Expected Output:**

```
✓ run-command started
  Running command in sandbox (command: npm, args: ["init", "-y"])
✓ Command execution completed (cmdId: xxxxx, exitCode: 0)
✓ run-command completed
```

### 4. Test File Generation

1. Ask the AI: "Create a simple Express.js server in index.js"
2. Watch Terminal 2 for:
   - `[write-files]` task being triggered
   - File paths being written
   - Success confirmation

**Expected Output:**

```
✓ write-files started
  Writing files to sandbox (fileCount: 1, paths: ["index.js"])
✓ Successfully wrote files to sandbox
✓ write-files completed
```

### 5. Test URL Generation

1. After creating a server, ask: "Get the URL for port 3000"
2. Watch Terminal 2 for:
   - `[get-sandbox-url]` task being triggered
   - URL generation
   - Successful return

**Expected Output:**

```
✓ get-sandbox-url started
  Getting sandbox URL (port: 3000)
✓ Successfully retrieved sandbox URL (url: https://sbx_xxxxx-3000.e2b.dev)
✓ get-sandbox-url completed
```

## Verification Checklist

✅ **All tasks appear in Trigger.dev dev console**

- Each AI tool action should trigger a corresponding Trigger.dev task
- Tasks should show detailed logging with run IDs

✅ **Real-time output is captured**

- Command execution should stream logs
- File uploads should show progress

✅ **Error handling works**

- Invalid operations should be caught and logged
- Errors should be returned to the AI with context

✅ **Task observability**

- Each task execution should have a unique run ID
- Logs should include sandboxId, command details, file counts, etc.
- Success/failure status should be clearly indicated

## Checking Trigger.dev Dashboard

1. Visit your Trigger.dev dashboard (https://cloud.trigger.dev)
2. Navigate to your project
3. Check the "Runs" section to see all executed tasks
4. Verify:
   - Task names match (`create-sandbox`, `run-command`, etc.)
   - Run history is being recorded
   - Logs are being captured
   - Errors are being tracked

## Production Deployment Testing

### 1. Deploy Trigger.dev Workflows

```bash
pnpm trigger:deploy
```

Verify that all 5 tasks are deployed:

- `create-sandbox`
- `run-command`
- `write-files`
- `get-sandbox-url`
- `get-sandbox-status`

### 2. Deploy Next.js Application

Deploy to your platform (Vercel, etc.) and ensure:

- `TRIGGER_SECRET_KEY` is set in environment variables
- `E2B_API_KEY` is set
- The application can reach Trigger.dev's production API

### 3. Test in Production

Repeat the test scenarios above in your production environment and verify:

- Tasks execute successfully
- Task logs appear in Trigger.dev dashboard
- Performance is acceptable
- Errors are properly handled and logged

## Common Issues

### Trigger.dev tasks not appearing

**Problem:** Tasks don't show up in the Trigger.dev console

**Solutions:**

1. Ensure `pnpm trigger:dev` is running
2. Check that `TRIGGER_SECRET_KEY` is set correctly
3. Verify `trigger.config.ts` has the correct project ID
4. Check for TypeScript/import errors in `trigger/sandbox.ts`

### Tasks failing silently

**Problem:** Tasks trigger but fail without clear errors

**Solutions:**

1. Check Trigger.dev console for detailed error logs
2. Verify `E2B_API_KEY` is valid
3. Ensure e2b sandboxes are being created successfully
4. Check network connectivity to e2b API

### Type errors

**Problem:** TypeScript errors when calling `tasks.trigger()`

**Solutions:**

1. Ensure `@trigger.dev/sdk` is version 4.0.6 or higher
2. Verify task imports are correct: `import type { taskName } from "@/trigger/sandbox"`
3. Check that task payload types match the task definitions

## Success Criteria

Your integration is successful when:

✅ All 5 Trigger.dev tasks are registered and visible in the dashboard
✅ Each AI tool action triggers its corresponding Trigger.dev task
✅ Task execution logs appear in real-time in the dev console
✅ Tasks complete successfully and return correct results
✅ Error handling works and provides useful feedback
✅ Task history is recorded in the Trigger.dev dashboard
✅ The user experience remains identical to the original Vibe Code demo

## Architecture Flow Verification

The correct flow should be:

```
User Input → AI Agent → AI Tool → Trigger.dev Task → E2BService → e2b API
                                         ↓
                                   Task Logging
                                   Error Handling
                                   Retry Logic
```

**NOT:**

```
User Input → AI Agent → AI Tool → E2BService → e2b API  ❌ (old, direct approach)
```

To verify this, check that:

1. No AI tool imports `E2BService` directly (except for `run-command.ts` which needs it for log streaming)
2. All AI tools import and use `tasks.trigger()` from `@trigger.dev/sdk/v3`
3. All operations go through Trigger.dev workflows
