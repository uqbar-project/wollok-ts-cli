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