// Test the fix for page body not displaying after refresh

const content = {
  guid: 'test',
  title: 'Test',
  content: '# Hello World\n\nThis is my content!',
  folderId: '',
  tags: [],
  status: 'published',
  createdBy: 'user1',
  modifiedBy: 'user1',
  createdAt: '2026-02-16T00:00:00Z',
  modifiedAt: '2026-02-16T00:00:00Z'
};

// Simulate the OLD way (buggy)
const lines_old = [
  '---',
  'title: "Test"',
  'guid: "test"',
  'status: "published"',
  'tags: []',
  'createdBy: "user1"',
  'modifiedBy: "user1"',
  'createdAt: "2026-02-16T00:00:00Z"',
  'modifiedAt: "2026-02-16T00:00:00Z"',
  '---',
  '' // Extra empty line (bug!)
];

const markdown_old = lines_old.join('\n') + content.content;

// Simulate the NEW way (fixed)
const lines_new = [
  '---',
  'title: "Test"',
  'guid: "test"',
  'status: "published"',
  'tags: []',
  'createdBy: "user1"',
  'modifiedBy: "user1"',
  'createdAt: "2026-02-16T00:00:00Z"',
  'modifiedAt: "2026-02-16T00:00:00Z"',
  '---'
];

const markdown_new = lines_new.join('\n') + '\n' + content.content;

// The regex used for parsing
const regex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

console.log('=== OLD METHOD (BUGGY) ===');
console.log(markdown_old);
console.log('\n--- Testing regex match ---');
const match_old = markdown_old.match(regex);
console.log('Match found:', !!match_old);
if (match_old) {
  console.log('Body content:', JSON.stringify(match_old[2]));
} else {
  console.log('NO MATCH! (body will be empty)');
}

console.log('\n\n=== NEW METHOD (FIXED) ===');
console.log(markdown_new);
console.log('\n--- Testing regex match ---');
const match_new = markdown_new.match(regex);
console.log('Match found:', !!match_new);
if (match_new) {
  console.log('Body content:', JSON.stringify(match_new[2]));
} else {
  console.log('NO MATCH! (body will be empty)');
}
