import { assertProdApiBaseUrl } from './assert-prod-api-base-url.mjs';

describe('assertProdApiBaseUrl', () => {
  it('accepts a real https api host', () => {
    expect(() => assertProdApiBaseUrl('https://api.bluefinwiki.bluefin605.com')).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => assertProdApiBaseUrl('')).toThrow(/empty|missing/i);
  });

  it('rejects http://', () => {
    expect(() => assertProdApiBaseUrl('http://api.example.com')).toThrow(/https/i);
  });

  it('rejects localhost and loopback', () => {
    expect(() => assertProdApiBaseUrl('https://localhost:3000')).toThrow(/local/i);
    expect(() => assertProdApiBaseUrl('https://127.0.0.1')).toThrow(/local/i);
    expect(() => assertProdApiBaseUrl('https://0.0.0.0')).toThrow(/local/i);
  });

  it('rejects a .local host', () => {
    expect(() => assertProdApiBaseUrl('https://box.local')).toThrow(/local/i);
  });

  it('allows a local value when allowLocal is set', () => {
    expect(() => assertProdApiBaseUrl('http://localhost:3000', { allowLocal: true })).not.toThrow();
  });
});
