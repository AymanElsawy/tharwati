import { z } from "zod"

import type { Translate } from "../../../i18n/context"
import {
  assetCurrencyCodes,
  assetTypeCodes,
  type AssetFormValues,
} from "../types/asset-form"

export function createAssetSchema(
  t: Translate,
): z.ZodType<AssetFormValues, AssetFormValues> {
  return z.object({
    assetTypeCode: z.enum(assetTypeCodes),
    name: z.string().trim().min(1, t("assets.validation.nameRequired")),
    symbol: z
      .string()
      .trim()
      .max(30, t("assets.validation.symbolTooLong")),
    currencyCode: z.enum(assetCurrencyCodes),
    exchange: z
      .string()
      .trim()
      .max(100, t("assets.validation.exchangeTooLong")),
    isActive: z.boolean(),
  })
}
