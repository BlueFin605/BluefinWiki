import { buildInheritedProperties } from './build-inherited-properties';
import type { PageProperty, PageTypeProperty } from './page.types';

function field(
  over: Partial<PageTypeProperty> & Pick<PageTypeProperty, 'name' | 'type'>,
): PageTypeProperty {
  return { required: false, ...over };
}

describe('buildInheritedProperties', () => {
  it('applies the schema default when the parent has no matching property', () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    expect(buildInheritedProperties(schema, null)).toEqual({
      status: { type: 'string', value: 'backlog' },
    });
  });

  it("inherits a parent property whose name and type match, overriding the schema's own default", () => {
    const schema = [field({ name: 'status', type: 'string', defaultValue: 'backlog' })];
    const parentProps: Record<string, PageProperty> = {
      status: { type: 'string', value: 'in-progress' },
    };
    expect(buildInheritedProperties(schema, parentProps)).toEqual({
      status: { type: 'string', value: 'in-progress' },
    });
  });

  it('ignores a parent property of the same name but a different type, using the schema default instead', () => {
    const schema = [field({ name: 'estimate', type: 'number', defaultValue: 3 })];
    const parentProps: Record<string, PageProperty> = {
      estimate: { type: 'string', value: 'three' },
    };
    expect(buildInheritedProperties(schema, parentProps)).toEqual({
      estimate: { type: 'number', value: 3 },
    });
  });

  it('seeds a type-appropriate empty value for a schema field with no default and no parent value', () => {
    const schema = [
      field({ name: 'due', type: 'date' }),
      field({ name: 'labels', type: 'tags' }),
    ];
    expect(buildInheritedProperties(schema, undefined)).toEqual({
      due: { type: 'date', value: '' },
      labels: { type: 'tags', value: [] },
    });
  });

  it('returns a clone of the parent properties (not mutated) when the schema is empty', () => {
    const parentProps: Record<string, PageProperty> = {
      foo: { type: 'string', value: 'bar' },
    };
    const result = buildInheritedProperties([], parentProps);
    expect(result).toEqual(parentProps);
    expect(result).not.toBe(parentProps);
  });
});
