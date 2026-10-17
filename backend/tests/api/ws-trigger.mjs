// Fires the REST writes the ws folder listens for. FullyRested cannot sequence
// a trigger inside a run (see GAPS.md), so run this beside `run --folder ws`.
// Usage: WS_TRIGGER_TOKEN=<bearer token> node ws-trigger.mjs [cycles] [baseUrl]
// Each cycle creates a published page (upsert) then deletes it (invalidate).
const token = process.env.WS_TRIGGER_TOKEN;
if (!token) throw new Error('set WS_TRIGGER_TOKEN');
const cycles = Number(process.argv[2] ?? 12);
const base = process.argv[3] ?? 'http://localhost:3000';
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Client-Id': 'api-suite-ws' };
for (let i = 0; i < cycles; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(`${base}/pages`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'api-suite ws trigger', content: 'x', tags: ['api-suite'], status: 'published' }) });
  const page = await res.json();
  const guid = page.guid ?? page.page?.guid;
  if (guid) await fetch(`${base}/pages/${guid}`, { method: 'DELETE', headers: h });
}
