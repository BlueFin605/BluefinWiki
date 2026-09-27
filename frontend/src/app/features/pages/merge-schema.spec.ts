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

  it('keeps existing properties that are not in the new schema (union merge)', () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    const existing: Record<string, PageProperty> = {
      status: { type: 'string', value: 'done' },
      legacyField: { type: 'string', value: 'keep me' },
      oldCount: { type: 'number', value: 9 },
    };
    expect(mergeSchema(existing, schema)).toEqual({
      status: { type: 'string', value: 'done' },
      legacyField: { type: 'string', value: 'keep me' },
      oldCount: { type: 'number', value: 9 },
    });
  });

  it('lets a non-schema property survive a type switch', () => {
    const typeB = [field({ name: 'assignee', type: 'string', defaultValue: '' })];
    const onTypeA: Record<string, PageProperty> = {
      priority: { type: 'string', value: 'high' }, // A-only field
    };
    const merged = mergeSchema(onTypeA, typeB);
    expect(merged['priority']).toEqual({ type: 'string', value: 'high' });
    expect(merged['assignee']).toEqual({ type: 'string', value: '' });
  });

  it('round-trips every value through A -> B -> A', () => {
    const typeA = [
      field({ name: 'status', type: 'string', defaultValue: 'backlog' }),
      field({ name: 'points', type: 'number', defaultValue: 1 }),
    ];
    const typeB = [field({ name: 'assignee', type: 'string', defaultValue: '' })];

    const onA: Record<string, PageProperty> = {
      status: { type: 'string', value: 'in-progress' },
      points: { type: 'number', value: 8 },
      notes: { type: 'string', value: 'ad-hoc note' }, // never in any schema
    };

    const onB = mergeSchema(onA, typeB);
    const backOnA = mergeSchema(onB, typeA);

    expect(backOnA).toEqual({
      status: { type: 'string', value: 'in-progress' },
      points: { type: 'number', value: 8 },
      assignee: { type: 'string', value: '' }, // picked up while on B, retained
      notes: { type: 'string', value: 'ad-hoc note' },
    });
  });

  it('orders schema fields (in schema order) before the remaining existing props (in insertion order)', () => {
    const schema = [
      field({ name: 'gamma', type: 'string', defaultValue: 'g' }),
      field({ name: 'alpha', type: 'string', defaultValue: 'a' }),
    ];
    const existing: Record<string, PageProperty> = {
      zeta: { type: 'string', value: 'Z' },
      alpha: { type: 'string', value: 'A' },
      beta: { type: 'string', value: 'B' },
    };
    const result = mergeSchema(existing, schema);
    expect(Object.keys(result)).toEqual(['gamma', 'alpha', 'zeta', 'beta']);
  });

  it('is deterministic — identical inputs yield a deep-equal result', () => {
    const schema = [
      field({ name: 'status', type: 'string', defaultValue: 'backlog' }),
      field({ name: 'labels', type: 'tags', defaultValue: ['x', 'y'] }),
    ];
    const existing: Record<string, PageProperty> = {
      status: { type: 'string', value: 'done' },
      adhoc: { type: 'number', value: 2 },
    };
    const a = mergeSchema(existing, schema);
    const b = mergeSchema(existing, schema);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('returns a cloned copy of the existing props for an empty schema', () => {
    const existing: Record<string, PageProperty> = {
      foo: { type: 'string', value: 'bar' },
      tags: { type: 'tags', value: ['a', 'b'] },
    };
    const result = mergeSchema(existing, []);
    expect(result).toEqual(existing);
    expect(result).not.toBe(existing);
    (result['tags'].value as string[]).push('c');
    expect(existing['tags'].value).toEqual(['a', 'b']);
  });

  it('does not mutate its inputs and clones array values', () => {
    const defaultLabels = ['x', 'y'];
    const schema = [field({ name: 'labels', type: 'tags', defaultValue: defaultLabels })];

    const empty: Record<string, PageProperty> = {};
    const result = mergeSchema(empty, schema);
    (result['labels'].value as string[]).push('z');
    expect(defaultLabels).toEqual(['x', 'y']);
    expect(empty).toEqual({});

    const existingLabels = ['a', 'b'];
    const existing2: Record<string, PageProperty> = { labels: { type: 'tags', value: existingLabels } };
    const result2 = mergeSchema(existing2, schema);
    (result2['labels'].value as string[]).push('c');
    expect(existingLabels).toEqual(['a', 'b']);
  });
});
