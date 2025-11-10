import { NextResponse, type NextRequest } from 'next/server'
import { E2BService } from '@/lib/e2b-service'

interface Params {
  sandboxId: string
  cmdId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const cmdParams = await params
  const service = E2BService.getInstance()

  try {
    await service.getSandbox(cmdParams.sandboxId)
    
    return NextResponse.json({
      sandboxId: cmdParams.sandboxId,
      cmdId: cmdParams.cmdId,
      startedAt: Date.now(),
      exitCode: null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Command or sandbox not found' },
      { status: 404 }
    )
  }
}
