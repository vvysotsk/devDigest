import type { FeatureModelChoice, FeatureModelDef } from "@/lib/types";
import type { PricedModel } from "@/lib/model-label";

/**
 * The `{ provider, model }` to store when the user picks `model` for feature
 * `f` (HW02 #53). The live list comes from OpenRouter, so a model from it is an
 * OpenRouter id. Anything else is a value the picker added itself: the saved
 * choice keeps its own provider, and the registry default keeps the default's
 * provider (e.g. conventions → `openai` / `gpt-5.4`), never a hard-coded
 * `openrouter`.
 */
export function featureModelChoice(
  f: FeatureModelDef,
  model: string,
  saved: FeatureModelChoice | undefined,
  live: PricedModel[] | undefined,
): FeatureModelChoice {
  if ((live ?? []).some((m) => m.id === model)) return { provider: "openrouter", model };
  if (saved && saved.model === model) return saved;
  if (model === f.defaultModel) return { provider: f.defaultProvider, model };
  return { provider: "openrouter", model };
}
