import { Logger } from 'loglevel'

export class TimeMeasurer {
  private initialTime: number = this.now()

  private now(): number {
    return this.getTime(process.hrtime.bigint())
  }

  private getTime(value: bigint): number {
    return Number(value / BigInt(1000000))
  }

  public elapsedTime(): number {
    return this.now() - this.initialTime
  }
}

const MAX_SAMPLES = 30
export class EventProfiler {
  private samples = 0
  private elapsedTime = 0

  constructor(private logger: Logger, private label: string = 'PROFILE') { }

  public runEvent = (f: () => any) => {
    const timeMeasurer = new TimeMeasurer()
    f()
    this.elapsedTime += timeMeasurer.elapsedTime()
    this.samples++

    if (this.samples >= MAX_SAMPLES) {
      this.notify()
      this.restart()
    }
  }

  private restart() {
    this.samples = 0
    this.elapsedTime = 0
  }

  private notify() {
    this.logger.debug(`${this.label}: ${(this.elapsedTime / this.samples).toFixed(2)} ms`)
  }
}
