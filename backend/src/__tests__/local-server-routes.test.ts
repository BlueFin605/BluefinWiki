import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

// Express matches routes in registration order, so static GET /pages/<segment>
// routes must be registered before GET /pages/:guid or they are captured as a guid.
describe('local-server route order', () => {
  const source = readFileSync(join(__dirname, '..', 'local-server.ts'), 'utf8');
  const indexOf = (needle: string): number => source.indexOf(needle);

  it('registers GET /pages/search before GET /pages/:guid', () => {
    const search = indexOf("app.get('/pages/search'");
    const guid = indexOf("app.get('/pages/:guid'");
    expect(search).toBeGreaterThan(-1);
    expect(guid).toBeGreaterThan(-1);
    expect(search).toBeLessThan(guid);
  });
});
