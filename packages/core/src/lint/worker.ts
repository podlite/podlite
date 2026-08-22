import { parentPort } from 'worker_threads'
import type { LintConfig } from './types'
import { lintFile } from './index'
import type { FileReport } from './formatters/text'

type Job = { index: number; filePath: string }
type Batch = { config: LintConfig; jobs: Job[] }
export type WorkerResult = { index: number; report: FileReport }

if (parentPort) {
  const port = parentPort
  // the first message back says the parser is loaded and the thread can be fed
  port.postMessage('ready')
  port.on('message', (batch: Batch) => {
    const done: WorkerResult[] = batch.jobs.map(job => ({
      index: job.index,
      report: lintFile(job.filePath, batch.config),
    }))
    port.postMessage(done)
  })
}
