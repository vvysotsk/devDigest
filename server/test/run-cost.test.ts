import { describe, it, expect, vi } from 'vitest';
import { resolveRunCost, type CostableRun } from '../src/modules/_shared/run-cost.js';

const doneRun = (o: Partial<CostableRun> = {}): CostableRun => ({
  costUsd: null,
  status: 'done',
  model: 'deepseek/deepseek-v4-flash',
  tokensIn: 8200,
  tokensOut: 1300,
  ...o,
});

describe('resolveRunCost', () => {
  it('stored cost wins over the estimate', () => {
    const estimate = vi.fn(() => 99);
    expect(resolveRunCost(doneRun({ costUsd: 0.0014 }), estimate)).toBe(0.0014);
    expect(estimate).not.toHaveBeenCalled();
  });

  it('a stored 0 is kept (free model), not treated as missing', () => {
    const estimate = vi.fn(() => 99);
    expect(resolveRunCost(doneRun({ costUsd: 0 }), estimate)).toBe(0);
    expect(estimate).not.toHaveBeenCalled();
  });

  it('legacy done run with tokens falls back to the estimate', () => {
    const estimate = vi.fn(() => 0.002);
    expect(resolveRunCost(doneRun(), estimate)).toBe(0.002);
    expect(estimate).toHaveBeenCalledWith('deepseek/deepseek-v4-flash', 8200, 1300);
  });

  it('unknown model (estimator returns null) resolves to null', () => {
    expect(resolveRunCost(doneRun({ model: 'acme/unknown' }), () => null)).toBeNull();
  });

  it('done run without any tokens resolves to null — never a fake $0', () => {
    const estimate = vi.fn(() => 99);
    expect(resolveRunCost(doneRun({ tokensIn: 0, tokensOut: 0 }), estimate)).toBeNull();
    expect(resolveRunCost(doneRun({ tokensIn: null, tokensOut: null }), estimate)).toBeNull();
    expect(estimate).not.toHaveBeenCalled();
  });

  it('non-settled runs never get an estimate', () => {
    const estimate = vi.fn(() => 99);
    for (const status of ['running', 'failed', 'cancelled', null]) {
      expect(resolveRunCost(doneRun({ status }), estimate)).toBeNull();
    }
    expect(estimate).not.toHaveBeenCalled();
  });

  it('missing model on a done run resolves to null', () => {
    expect(resolveRunCost(doneRun({ model: null }), () => 99)).toBeNull();
  });
});
