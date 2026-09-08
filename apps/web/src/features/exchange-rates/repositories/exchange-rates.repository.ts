import { supabase } from "@/lib/supabase"
import { requireQueryData } from "@/lib/supabase/repository"
import { exchangeRateService } from "@/services/exchange-rates"
import type { ExchangeRateFormValues } from "@/features/exchange-rates/types/exchange-rate-form"

export class ManagedExchangeRatesRepository {
  async list() {
    return exchangeRateService.listRates()
  }

  async listActiveCurrencies() {
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .eq("is_active", true)
      .order("code")
    return requireQueryData(data, error, "exchangeRates.listCurrencies")
  }

  async create(values: ExchangeRateFormValues) {
    return exchangeRateService.createRate({
      sourceCurrencyCode: values.fromCurrencyCode,
      destinationCurrencyCode: values.toCurrencyCode,
      rate: values.rate,
      effectiveAt: values.effectiveAt,
    })
  }

  async update(id: string, values: ExchangeRateFormValues) {
    return exchangeRateService.updateRate(id, {
      sourceCurrencyCode: values.fromCurrencyCode,
      destinationCurrencyCode: values.toCurrencyCode,
      rate: values.rate,
      effectiveAt: values.effectiveAt,
    })
  }

  async delete(id: string) {
    return exchangeRateService.deleteRate(id)
  }
}

export const managedExchangeRatesRepository = new ManagedExchangeRatesRepository()
