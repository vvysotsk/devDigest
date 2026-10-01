import type { FeatureModelChoice, FeatureModelId } from '@devdigest/shared';

/**
 * Cross-module port of the settings module (HW02 D8, #53): the provider and
 * model a system LLM feature runs with — the workspace's Settings override,
 * else the `FEATURE_MODELS` default. Wired as `container.featureModels` from
 * `feature-models.ts`; consumers (the conventions extractor) type it as
 * `Container['featureModels']` and never import this folder.
 */
export interface FeatureModelResolver {
  resolve(workspaceId: string, id: FeatureModelId): Promise<FeatureModelChoice>;
}
