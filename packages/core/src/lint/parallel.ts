import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Worker } from 'worker_threads'
import type { LintConfig } from './types'
import type { FileReport } from './formatters/text'
import { lintFile } from './index'
import type { WorkerResult } from './worker'

// Measured on a 126-file corpus: reading takes 5 ms and parsing 1032 ms, so the
// work is bound by the processor and threads are what buys anything. Eight of
// them start in 80 ms together, which pays for itself only on a longer list.
const MIN_FILES = 12

const threadCount = (files: number): number => Math.max(2, Math.min(os.cpus().length - 2, 8, Math.floor(files / 4)))

const workerFile = (): string | undefined => {
  const candidate = path.join(__dirname, 'worker.js')
  return fs.existsSync(candidate) ? candidate : undefined
}

export const worthThreads = (files: string[]): boolean => files.length >= MIN_FILES && workerFile() !== undefined

// Reports come back in the order the files were given, whichever thread got
// there first: the report is read by a person and by a snapshot test, and both
// expect the order they asked for.
export function lintFilesInParallel(files: string[], config: LintConfig): Promise<FileReport[]> {
  const script = workerFile()
  if (!script) return Promise.resolve(files.map(f => lintFile(f, config)))

  const threads = threadCount(files.length)
  const jobs = files.map((filePath, index) => ({ index, filePath }))
  const chunks: Array<typeof jobs> = Array.from({ length: threads }, () => [])
  jobs.forEach(job => chunks[job.index % threads].push(job))

  return new Promise((resolve, reject) => {
    const collected: FileReport[] = new Array(files.length)
    const workers: Worker[] = []
    let finished = 0
    let failed = false

    const stop = () => workers.forEach(w => void w.terminate())

    for (let i = 0; i < threads; i++) {
      const worker = new Worker(script)
      workers.push(worker)
      worker.on('message', (message: 'ready' | WorkerResult[]) => {
        if (message === 'ready') {
          worker.postMessage({ config, jobs: chunks[i] })
          return
        }
        for (const item of message) collected[item.index] = item.report
        void worker.terminate()
        if (++finished === threads && !failed) resolve(collected)
      })
      worker.on('error', err => {
        if (failed) return
        failed = true
        stop()
        reject(err)
      })
    }
  })
}
