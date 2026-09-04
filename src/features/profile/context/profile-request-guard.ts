export type ProfileRequest = {
  userId: string
  version: number
}

export class ProfileRequestGuard {
  private activeUserId: string
  private version = 0

  constructor(userId: string) {
    this.activeUserId = userId
  }

  setActiveUser(userId: string) {
    if (this.activeUserId !== userId) {
      this.activeUserId = userId
      this.version += 1
    }
  }

  begin(userId: string): ProfileRequest {
    if (this.activeUserId !== userId) return { userId, version: -1 }
    this.version += 1
    return { userId, version: this.version }
  }

  invalidate() {
    this.version += 1
  }

  isCurrent(request: ProfileRequest) {
    return request.userId === this.activeUserId && request.version === this.version
  }
}
