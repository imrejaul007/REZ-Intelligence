import { logger } from './logger'

interface ShutdownOptions {
  timeout: number
  onShutdown: () => Promise<void>
}

class GracefulShutdown {
  private handlers: Map<string, ShutdownOptions> = new Map()
  private isShuttingDown = false

  register(name: string, options: ShutdownOptions): void {
    this.handlers.set(name, options)
  }

  start(): void {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'))
    process.on('SIGINT', () => this.shutdown('SIGINT'))
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    logger.info(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`)

    await Promise.allSettled(
      Array.from(this.handlers.entries()).map(async ([name, opts]) => {
        logger.info(`[SHUTDOWN] Stopping ${name}...`)
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), opts.timeout),
        )

        try {
          await Promise.race([opts.onShutdown(), timeoutPromise])
          logger.info(`[SHUTDOWN] ${name} stopped gracefully`)
        } catch (error) {
          logger.error(`[SHUTDOWN] ${name} failed`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }),
    )

    logger.info('[SHUTDOWN] All services stopped')
    process.exit(0)
  }
}

export const gracefulShutdown = new GracefulShutdown()
