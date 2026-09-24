import { describe, it, expect } from 'vitest';
import {
  groupLatestBatches,
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
  it('keeps every run of the newest batch and sums their cost', () => {
    const batches = groupLatestBatches(
      [
        run({ id: 'r3', batchId: 'b2', costUsd: 0.002 }),
        run({ id: 'r2', batchId: 'b2', costUsd: 0.003 }),
        run({ id: 'r1', batchId: 'b1', costUsd: 0.5 }), // older batch — excluded
      ],
      noEstimate,
    );
    expect(batches.get('pr1')).toEqual({ runIds: ['r3', 'r2'], costUsd: 0.005 });
  });

  it('legacy rows without batch_id: only the latest run is the batch', () => {
    const batches = groupLatestBatches(
      [run({ id: 'r2', batchId: null }), run({ id: 'r1', batchId: null, costUsd: 0.9 })],
      noEstimate,
    );
    expect(batches.get('pr1')).toEqual({ runIds: ['r2'], costUsd: 0.001 });
  });

  it('groups several PRs interleaved in one newest-first stream', () => {
    const batches = groupLatestBatches(
      [
        run({ id: 'a2', prId: 'prA', batchId: 'bA2' }),
        run({ id: 'b1', prId: 'prB', batchId: 'bB1' }),
        run({ id: 'a1', prId: 'prA', batchId: 'bA1' }),
        run({ id: 'b0', prId: 'prB', batchId: 'bB1' }),
        run({ id: 'x', prId: null }), // set-null row from a deleted PR
      ],
      noEstimate,
    );
    expect([...batches.keys()]).toEqual(['prA', 'prB']);
    expect(batches.get('prA')!.runIds).toEqual(['a2']);
    expect(batches.get('prB')!.runIds).toEqual(['b1', 'b0']);
  });

  it('cost stays null when no run in the batch has usage data; estimate is used for legacy rows', () => {
    const none = groupLatestBatches(
      [run({ id: 'r1', costUsd: null, tokensIn: 0, tokensOut: 0 })],
      noEstimate,
    );
    expect(none.get('pr1')).toEqual({ runIds: ['r1'], costUsd: null });

    const estimated = groupLatestBatches([run({ id: 'r1', costUsd: null })], () => 0.0006);
    expect(estimated.get('pr1')!.costUsd).toBeCloseTo(0.0006, 6);
  });

  it('a running run still belongs to the batch (run_ids) but adds no cost', () => {
    const batches = groupLatestBatches(
      [run({ id: 'r2', status: 'running', costUsd: null }), run({ id: 'r1', costUsd: 0.002 })],
      noEstimate,
    );
    expect(batches.get('pr1')).toEqual({ runIds: ['r2', 'r1'], costUsd: 0.002 });
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
