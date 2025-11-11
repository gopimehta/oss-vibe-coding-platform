'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSandboxStore } from '@/app/state'
import { useEffect } from 'react'
import * as React from 'react'
import useSWR from 'swr'

export function SandboxState() {
  const { sandboxId, status, setStatus } = useSandboxStore()
  if (status === 'stopped') {
    return (
      <Dialog open>
        <DialogHeader className="sr-only">
          <DialogTitle className="sr-only">
            Sandbox session ended
          </DialogTitle>
          <DialogDescription className="sr-only">
            The e2b Sandbox session has ended. You can start a new session
            by clicking the button below.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          Sandbox session has ended
          <Button onClick={() => window.location.reload()}>
            Start a new session
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return sandboxId ? (
    <DirtyChecker sandboxId={sandboxId} setStatus={setStatus} />
  ) : null
}

interface DirtyCheckerProps {
  sandboxId: string
  setStatus: (status: 'running' | 'stopped') => void
}

function DirtyChecker({ sandboxId, setStatus }: DirtyCheckerProps) {
  const [shouldCheck, setShouldCheck] = React.useState(false)
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShouldCheck(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [sandboxId])

  const content = useSWR<'running' | 'stopped'>(
    shouldCheck && sandboxId ? `/api/sandboxes/${sandboxId}` : null,
    async (pathname: string, init: RequestInit) => {
      const response = await fetch(pathname, init)
      const { status } = await response.json()
      return status
    },
    { 
      refreshInterval: 5000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  useEffect(() => {
    if (content.data === 'stopped' && !content.isLoading) {
      setStatus('stopped')
    } else if (content.data === 'running') {
      setStatus('running')
    }
  }, [setStatus, content.data, content.isLoading])

  return null
}
