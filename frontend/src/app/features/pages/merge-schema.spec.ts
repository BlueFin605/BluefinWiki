import { mergeSchema } from './merge-schema';
import type { PageProperty, PageTypeProperty } from './page.types';

function field(over: Partial<PageTypeProperty> & Pick<PageTypeProperty, 'name' | 'type'>): PageTypeProperty {
  return { required: false, ...over };
}

describe('mergeSchema', () => {
  it('applies the schema default for a field with no existing value', () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    expect(mergeSchema({}, schema)).toEqual({
      status: { type: 'string', value: 'backlog' },
    });
  });

  it('seeds a type-appropriate empty when a new field has no defaultValue', () => {
    const schema = [
      field({ name: 'note', type: 'string' }),
      field({ name: 'due', type: 'date' }),
      field({ name: 'points', type: 'number' }),
      field({ name: 'labels', type: 'tags' }),
    ];
    expect(mergeSchema(undefined, schema)).toEqual({
      note: { type: 'string', value: '' },
      due: { type: 'date', value: '' },
      points: { type: 'number', value: '' },
      labels: { type: 'tags', value: [] },
    });
  });

  it('retains an existing value whose name and type still apply', () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    const existing: Record<string, PageProperty> = {
      status: { type: 'string', value: 'in-progress' },
    };
    expect(mergeSchema(existing, schema)).toEqual({
      status: { type: 'string', value: 'in-progress' },
    });
  });

  it('replaces an existing value of an incompatible type with the schema default', () => {
    const schema = [field({ name: 'estimate', type: 'number', defaultValue: 3 })];
    const existing: Record<string, PageProperty> = {
      estimate: { type: 'string', value: 'three' },
    };
    expect(mergeSchema(existing, schema)).toEqual({
      estimate: { type: 'number', value: 3 },
    });
  });

  it('drops existing properties that are not in the new schema', () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    const existing: Record<string, PageProperty> = {
      status: { type: 'string', value: 'done' },
      legacyField: { type: 'string', value: 'keep me?' },
      oldCount: { type: 'number', value: 9 },
    };
    expect(mergeSchema(existing, schema)).toEqual({
      status: { type: 'string', value: 'done' },
    });
  });

  it('produces keys in schema order, regardless of existingProps key order', () => {
    const schema = [
      field({ name: 'alpha', type: 'string', defaultValue: 'a' }),
      field({ name: 'beta', type: 'string', defaultValue: 'b' }),
      field({ name: 'gamma', type: 'string', defaultValue: 'c' }),
    ];
    const shuffled: Record<string, PageProperty> = {
      gamma: { type: 'string', value: 'G' },
      alpha: { type: 'string', value: 'A' },
      beta: { type: 'string', value: 'B' },
    };
    const result = mergeSchema(shuffled, schema);
    expect(Object.keys(result)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('is deterministic — identical inputs yield a deep-equal result', () => {
    const schema = [
      field({ name: 'status', type: 'string', defaultValue: 'backlog' }),
      field({ name: 'labels', type: 'tags', defaultValue: ['x', 'y'] }),
    ];
    const existing: Record<string, PageProperty> = { status: { type: 'string', value: 'done' } };
    const a = mergeSchema(existing, schema);
    const b = mergeSchema(existing, schema);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('returns an empty object for an empty schema', () => {
    expect(mergeSchema({ foo: { type: 'string', value: 'bar' } }, [])).toEqual({});
  });

  it('does not mutate its inputs and clones array values', () => {
    const defaultLabels = ['x', 'y'];
    const schema = [field({ name: 'labels', type: 'tags', defaultValue: defaultLabels })];
    const existing: Record<string, PageProperty> = {};
    const result = mergeSchema(existing, schema);

    (result['labels'].value as string[]).push('z');
    expect(defaultLabels).toEqual(['x', 'y']);
    expect(existing).toEqual({});

    const existingLabels = ['a', 'b'];
    const existing2: Record<string, PageProperty> = { labels: { type: 'tags', value: existingLabels } };
    const result2 = mergeSchema(existing2, schema);
    (result2['labels'].value as string[]).push('c');
    expect(existingLabels).toEqual(['a', 'b']);
  });
});
