/** How often the plugin reads its DMs with the other side (owner ↔ operator). */
export const POLL_INTERVAL_MS = 60_000

export interface Poll {
  /** Runs `read`; a call while one is in flight joins it instead of starting another. */
  poll(): Promise<void>
  /** `poll`, logging a failure instead of rejecting; the next tick retries. */
  pollSafely(): Promise<void>
}

/** A slow read must not overlap the next tick: callers join the read in flight. */
export const createPoll = (read: () => Promise<void>, what: string): Poll => {
  let inFlight: Promise<void> | undefined
  const poll = (): Promise<void> => {
    inFlight ??= read().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }
  return {
    poll,
    pollSafely: async () => {
      try {
        await poll()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`Self-hosted agents: ${what} failed: ${message}`)
      }
    },
  }
}
