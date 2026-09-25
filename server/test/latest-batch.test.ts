import { describe, it, expect } from 'vitest';
import {
  groupLatestBatches,
  sumSettledRunCost,
  countFindingsBySeverity,
  emptyFindingsBySeverity,
  type BatchRunRow,
} from '../src/modules/_shared/latest-batch.js';

const run = (o: Partial<BatchRunRow> & { id: string }): BatchRunRow => ({
  prId: 'pr1',
  batchId: 'b1',
  costUsd: 0.001,
  status: 'done',
  model: 'deepseek/deepseek-v4-flash',
  tokensIn: 100,
  tokensOut: 50,
  ...o,
});

const noEstimate = () => null;

describe('groupLatestBatches', () => {
  it('keeps every run of the newest batch only', () => {
    const batches = groupLatestBatches([
      run({ id: 'r3', batchId: 'b2' }),
      run({ id: 'r2', batchId: 'b2' }),
      run({ id: 'r1', batchId: 'b1' }), // older batch — excluded
    ]);
    expect(batches.get('pr1')).toEqual({ runIds: ['r3', 'r2'] });
  });

  it('legacy rows without batch_id: only the latest run is the batch', () => {
    const batches = groupLatestBatches([run({ id: 'r2', batchId: null }), run({ id: 'r1', batchId: null })]);
    expect(batches.get('pr1')).toEqual({ runIds: ['r2'] });
  });

  it('groups several PRs interleaved in one newest-first stream', () => {
    const batches = groupLatestBatches([
      run({ id: 'a2', prId: 'prA', batchId: 'bA2' }),
      run({ id: 'b1', prId: 'prB', batchId: 'bB1' }),
      run({ id: 'a1', prId: 'prA', batchId: 'bA1' }),
      run({ id: 'b0', prId: 'prB', batchId: 'bB1' }),
      run({ id: 'x', prId: null }), // set-null row from a deleted PR
    ]);
    expect([...batches.keys()]).toEqual(['prA', 'prB']);
    expect(batches.get('prA')!.runIds).toEqual(['a2']);
    expect(batches.get('prB')!.runIds).toEqual(['b1', 'b0']);
  });

  it('a running run still belongs to the batch', () => {
    const batches = groupLatestBatches([run({ id: 'r2', status: 'running', costUsd: null }), run({ id: 'r1' })]);
    expect(batches.get('pr1')).toEqual({ runIds: ['r2', 'r1'] });
  });
});

describe('sumSettledRunCost (criterion 12: every done run, any batch)', () => {
  it('sums settled runs across batches', () => {
    const cost = sumSettledRunCost(
      [
        run({ id: 'r3', batchId: 'b2', costUsd: 0.002 }),
        run({ id: 'r2', batchId: 'b1', costUsd: 0.003 }),
        run({ id: 'r1', batchId: null, costUsd: 0.5 }),
      ],
      noEstimate,
    );
    expect(cost.get('pr1')).toBeCloseTo(0.505, 9);
  });

  it('failed / cancelled / running runs never contribute, even with a stored cost', () => {
    const cost = sumSettledRunCost(
      [
        run({ id: 'r4', status: 'running', costUsd: 9 }),
        run({ id: 'r3', status: 'failed', costUsd: 9 }),
        run({ id: 'r2', status: 'cancelled', costUsd: 9 }),
        run({ id: 'r1', status: 'done', costUsd: 0.001 }),
      ],
      noEstimate,
    );
    expect(cost.get('pr1')).toBeCloseTo(0.001, 9);
  });

  it('no settled run with cost → PR absent (the list shows a dash, never $0.00)', () => {
    const cost = sumSettledRunCost(
      [
        run({ id: 'r2', status: 'failed', costUsd: null }),
        run({ id: 'r1', status: 'done', costUsd: null, tokensIn: 0, tokensOut: 0 }),
      ],
      noEstimate,
    );
    expect(cost.get('pr1')).toBeUndefined();
    expect(sumSettledRunCost([], noEstimate).size).toBe(0);
  });

  it('legacy settled rows without stored cost use the estimate; a stored 0 counts as 0', () => {
    const cost = sumSettledRunCost(
      [run({ id: 'r2', costUsd: null }), run({ id: 'r1', costUsd: 0 })],
      () => 0.0006,
    );
    expect(cost.get('pr1')).toBeCloseTo(0.0006, 9);
  });

  it('keeps PRs apart and skips set-null rows', () => {
    const cost = sumSettledRunCost(
      [run({ id: 'a', prId: 'prA', costUsd: 0.1 }), run({ id: 'b', prId: 'prB', costUsd: 0.2 }), run({ id: 'x', prId: null, costUsd: 5 })],
      noEstimate,
    );
    expect([...cost.entries()]).toEqual([
      ['prA', 0.1],
      ['prB', 0.2],
    ]);
  });
});

describe('countFindingsBySeverity', () => {
  it('counts per PR and ignores severities outside the contract', () => {
    const counts = countFindingsBySeverity([
      { prId: 'pr1', severity: 'CRITICAL' },
      { prId: 'pr1', severity: 'WARNING' },
      { prId: 'pr2', severity: 'SUGGESTION' },
      { prId: 'pr1', severity: 'WARNING' },
      { prId: 'pr1', severity: 'INFO' },
    ]);
    expect(counts.get('pr1')).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 });
    expect(counts.get('pr2')).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 1 });
  });

  it('a PR whose batch produced no findings is absent → callers use the empty shape', () => {
    const counts = countFindingsBySeverity([]);
    expect(counts.get('pr1')).toBeUndefined();
    expect(emptyFindingsBySeverity()).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });
});
