// Test the actual old code path

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

// OLD CODE (before fix):
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
  '' // This creates an extra \n when joined!
];

// When lines_old is joined with '\n' and concatenated with content:
// Result is: "...\n---\n" (note the empty string at the end becomes "\n")
// Then content.content is added WITHOUT newline: "...\n---\n<content>"
const markdown_old = lines_old.join('\n') + content.content;

// NEW CODE (after fix):
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
  // No empty string!
];

// When lines_new is joined with '\n' and '\n' is added before content:
// Result is: "...\n---\n<content>"
const markdown_new = lines_new.join('\n') + '\n' + content.content;

// The regex expects exactly: ---\n<frontmatter>\n---\n<body>
const regex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

console.log('=== OLD METHOD ===');
console.log('Serialized (showing \\n):');
console.log(JSON.stringify(markdown_old));
console.log('\nActual output:');
console.log(markdown_old);
console.log('\n--- Regex Test ---');
const match_old = markdown_old.match(regex);
console.log('Match:', !!match_old);
if (match_old) {
  console.log('Body:', JSON.stringify(match_old[2]));
}

console.log('\n\n=== NEW METHOD ===');
console.log('Serialized (showing \\n):');
console.log(JSON.stringify(markdown_new));
console.log('\nActual output:');
console.log(markdown_new);
console.log('\n--- Regex Test ---');
const match_new = markdown_new.match(regex);
console.log('Match:', !!match_new);
if (match_new) {
  console.log('Body:', JSON.stringify(match_new[2]));
}
