import { describe, it, expect, vi, beforeEach } from 'vitest';

const xray = vi.hoisted(() => {
  const sub = { addAnnotation: vi.fn(), close: vi.fn() };
  const segment = { addNewSubsegment: vi.fn(() => sub) };
  const api = { setContextMissingStrategy: vi.fn(), getSegment: vi.fn((): unknown => segment) };
  return { sub, segment, api };
});
vi.mock('aws-xray-sdk-core', () => ({ default: xray.api }));

const { annotateRoute } = await import('../tracing.js');
// Snapshot now: beforeEach below clears call history before the first test.
const strategyCallsAtLoad = [...xray.api.setContextMissingStrategy.mock.calls];

describe('annotateRoute', () => {
  it('ignores missing trace context instead of logging errors', () => {
    expect(strategyCallsAtLoad).toContainEqual(['IGNORE_ERROR']);
  });

  beforeEach(() => {
    xray.sub.addAnnotation.mockClear();
    xray.sub.close.mockClear();
    xray.segment.addNewSubsegment.mockClear();
    xray.api.getSegment.mockReset().mockReturnValue(xray.segment);
  });

  it('adds the route as an annotation on a closed subsegment', () => {
    annotateRoute('GET /pages/{guid}');
    expect(xray.segment.addNewSubsegment).toHaveBeenCalledWith('router');
    expect(xray.sub.addAnnotation).toHaveBeenCalledWith('route', 'GET /pages/{guid}');
    expect(xray.sub.close).toHaveBeenCalled();
  });

  it('does nothing without a segment', () => {
    xray.api.getSegment.mockReturnValue(undefined);
    annotateRoute('GET /tags');
    expect(xray.segment.addNewSubsegment).not.toHaveBeenCalled();
  });

  it('never throws', () => {
    xray.api.getSegment.mockImplementation(() => { throw new Error('no context'); });
    expect(() => annotateRoute('GET /tags')).not.toThrow();
  });
});
