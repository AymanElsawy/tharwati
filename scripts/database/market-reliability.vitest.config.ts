import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { "npm:@supabase/supabase-js@2": fileURLToPath(new URL("../../node_modules/@supabase/supabase-js/dist/index.mjs", import.meta.url)) } },
  // Opt-in local tests temporarily exercise shared operational configuration.
  test: { include: ["supabase/functions/**/*.test.ts"], fileParallelism: false },
})
