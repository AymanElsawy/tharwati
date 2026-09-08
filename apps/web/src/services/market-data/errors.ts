export type MarketDataErrorCode =
  | "market_price_unavailable"
  | "unsupported_asset_type"
  | "invalid_market_price"
  | "future_market_price"
  | "provider_unavailable"
  | "provider_error"
  | "storage_error"

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode
  readonly assetId?: string

  constructor(options: {
    code: MarketDataErrorCode
    message: string
    assetId?: string
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = "MarketDataError"
    this.code = options.code
    this.assetId = options.assetId
  }
}
