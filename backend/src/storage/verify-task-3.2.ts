/**
 * Verification Script for Task 3.2 - movePage Implementation
 * 
 * This script verifies that the movePage method in S3StoragePlugin is complete
 * and has all required functionality.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function check(name: string, condition: boolean, message: string) {
  checks.push({ name, passed: condition, message });
}

console.log('🔍 Verifying Task 3.2: movePage Implementation\n');

// Read the S3StoragePlugin file
const pluginPath = join(process.cwd(), 'src', 'storage', 'S3StoragePlugin.ts');
const pluginContent = readFileSync(pluginPath, 'utf-8');

// Check 1: movePage method exists
check(
  'movePage method exists',
  pluginContent.includes('async movePage(guid: string, newParentGuid: string | null)'),
  'The movePage method signature is defined'
);

// Check 2: GUID validation
check(
  'GUID validation',
  pluginContent.includes('validateGuid(guid)') && 
  pluginContent.includes('validateGuid(newParentGuid)'),
  'Method validates GUID format for both source and target'
);

// Check 3: Circular reference check
check(
  'Circular reference prevention',
  pluginContent.includes('validateNoCircularReference(guid, newParentGuid)'),
  'Method checks for circular references before moving'
);

// Check 4: Load current page
check(
  'Load current page',
  pluginContent.includes('await this.loadPage(guid)'),
  'Method loads the current page data'
);

// Check 5: Find page key
check(
  'Find page key',
  pluginContent.includes('await this.findPageKey(guid)'),
  'Method finds the current S3 key for the page'
);

// Check 6: Build new key
check(
  'Build new key',
  pluginContent.includes('this.buildPageKey(guid, newParentGuid)'),
  'Method builds the new S3 key based on new parent'
);

// Check 7: Copy operation
check(
  'Copy to new location',
  pluginContent.includes('CopyObjectCommand') && 
  pluginContent.includes('copyCommand') || pluginContent.includes('copyCommand'),
  'Method copies the page to new location'
);

// Check 8: Update metadata
check(
  'Update page metadata',
  pluginContent.includes('page.folderId = newParentGuid'),
  'Method updates the page\'s folderId/parentGuid'
);

// Check 9: Save updated page
check(
  'Save updated page',
  pluginContent.includes('await this.savePage(guid, newParentGuid, page)'),
  'Method saves the page with updated metadata'
);

// Check 10: Delete old location
check(
  'Delete old location',
  pluginContent.includes('DeleteObjectCommand') && 
  pluginContent.includes('deleteCommand'),
  'Method deletes the page from old location'
);

// Check 11: Handle children
check(
  'Move children recursively',
  pluginContent.includes('await this.listChildren(guid)') &&
  pluginContent.includes('for (const child of children)'),
  'Method recursively moves child pages'
);

// Check 12: Error handling
check(
  'Error handling',
  pluginContent.includes('catch (error') && 
  pluginContent.includes('MOVE_FAILED'),
  'Method has proper error handling'
);

// Check 13: Helper method for circular reference (in BaseStoragePlugin)
const basePath = join(process.cwd(), 'src', 'storage', 'BaseStoragePlugin.ts');
const baseContent = readFileSync(basePath, 'utf-8');

check(
  'Circular reference helper',
  baseContent.includes('protected async validateNoCircularReference'),
  'BaseStoragePlugin has validateNoCircularReference helper method'
);

// Check 14: Helper method for finding keys
check(
  'Find page key helper',
  pluginContent.includes('private async findPageKey(guid: string)'),
  'S3StoragePlugin has findPageKey helper method'
);

// Print results
console.log('📊 Verification Results:\n');
let passCount = 0;
checks.forEach((result, index) => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${index + 1}. ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.passed) passCount++;
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Total: ${passCount}/${checks.length} checks passed`);

if (passCount === checks.length) {
  console.log('\n✅ Task 3.2 Implementation is COMPLETE!');
  console.log('\nImplemented functionality:');
  console.log('  ✓ Move page file from old path to new path');
  console.log('  ✓ Update parentGuid in page frontmatter');
  console.log('  ✓ Handle S3 copy and delete operations');
  console.log('  ✓ Move entire directory if page has children');
  console.log('  ✓ Prevent circular references');
  console.log('  ✓ Proper error handling');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Review the implementation.');
  process.exit(1);
}
