import { httpStatusOf } from './api.types';

describe('httpStatusOf', () => {
  it('reads the status of an ApiError', () => {
    expect(httpStatusOf({ status: 404, code: 'http_error', message: 'Not found' })).toBe(404);
  });

  it('reads the status through a cause (resource-wrapped error)', () => {
    expect(httpStatusOf(new Error('wrapped', { cause: { status: 404 } }))).toBe(404);
  });

  it('is undefined for errors without a status', () => {
    expect(httpStatusOf(new Error('boom'))).toBeUndefined();
    expect(httpStatusOf(null)).toBeUndefined();
    expect(httpStatusOf(undefined)).toBeUndefined();
    expect(httpStatusOf({ status: '404' })).toBeUndefined();
  });
});
