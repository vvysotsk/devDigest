import { describe, it, expect } from "vitest";
import { FEATURE_MODELS } from "@/lib/feature-models";
import { featureModelChoice } from "./helpers";

const conventions = FEATURE_MODELS.find((f) => f.id === "conventions")!;
const live = [{ id: "deepseek/deepseek-v4-flash" }, { id: "openai/gpt-5.4" }];

describe("featureModelChoice (#53)", () => {
  it("a model from the live OpenRouter list is stored with provider openrouter", () => {
    expect(featureModelChoice(conventions, "openai/gpt-5.4", undefined, live)).toEqual({
      provider: "openrouter",
      model: "openai/gpt-5.4",
    });
  });

  it("the registry default keeps its own provider, not a hard-coded openrouter", () => {
    expect(conventions.defaultProvider).toBe("openai");
    expect(featureModelChoice(conventions, conventions.defaultModel, undefined, live)).toEqual({
      provider: "openai",
      model: conventions.defaultModel,
    });
  });

  it("re-picking the saved choice keeps its saved provider (also with no live list)", () => {
    const saved = { provider: "anthropic" as const, model: "claude-sonnet-5" };
    expect(featureModelChoice(conventions, "claude-sonnet-5", saved, undefined)).toEqual(saved);
  });

  it("an unknown value falls back to openrouter", () => {
    expect(featureModelChoice(conventions, "some/other-model", undefined, [])).toEqual({
      provider: "openrouter",
      model: "some/other-model",
    });
  });
});
