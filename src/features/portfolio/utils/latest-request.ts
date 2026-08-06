export class LatestRequestGuard {
  private latestId = 0

  begin(): number {
    this.latestId += 1
    return this.latestId
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.latestId
  }
}
