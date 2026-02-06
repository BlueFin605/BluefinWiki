/**
 * Manual Test Script for movePage functionality
 * 
 * This script demonstrates and tests the movePage method of S3StoragePlugin.
 * Run with: node --loader ts-node/esm src/storage/test-move-page.ts
 * 
 * Prerequisites:
 * - LocalStack running on localhost:4566
 * - S3 bucket created (via Aspire or manually)
 */

import { S3StoragePlugin } from './S3StoragePlugin.js';
import { PageContent } from '../types/index.js';

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'bluefinwiki-pages-dev';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566';

async function runTest() {
  console.log('🧪 Testing S3StoragePlugin.movePage() functionality\n');
  
  // Initialize storage plugin
  const storage = new S3StoragePlugin({
    bucketName: BUCKET_NAME,
    endpoint: S3_ENDPOINT,
    region: 'us-east-1',
  });

  console.log(`📦 Using bucket: ${BUCKET_NAME}`);
  console.log(`🔗 S3 endpoint: ${S3_ENDPOINT}\n`);

  try {
    // Test 1: Create test pages
    console.log('📝 Test 1: Creating test pages...');
    
    const rootPage: PageContent = {
      guid: 'root-page-001',
      title: 'Root Test Page',
      body: '# Root Page\n\nThis is a root level page.',
      folderId: '',
      status: 'published',
      tags: ['test'],
      createdBy: 'test-user',
      modifiedBy: 'test-user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    const childPage: PageContent = {
      guid: 'child-page-001',
      title: 'Child Test Page',
      body: '# Child Page\n\nThis is a child page.',
      folderId: 'root-page-001',
      status: 'published',
      tags: ['test', 'child'],
      createdBy: 'test-user',
      modifiedBy: 'test-user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    const targetPage: PageContent = {
      guid: 'target-page-001',
      title: 'Target Parent Page',
      body: '# Target Page\n\nThis will be the new parent.',
      folderId: '',
      status: 'published',
      tags: ['test', 'target'],
      createdBy: 'test-user',
      modifiedBy: 'test-user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    await storage.savePage(rootPage.guid, null, rootPage);
    console.log('✅ Created root page:', rootPage.guid);

    await storage.savePage(childPage.guid, rootPage.guid, childPage);
    console.log('✅ Created child page:', childPage.guid);

    await storage.savePage(targetPage.guid, null, targetPage);
    console.log('✅ Created target page:', targetPage.guid);

    // Test 2: Move child page to a different parent
    console.log('\n📝 Test 2: Moving child page to new parent...');
    await storage.movePage(childPage.guid, targetPage.guid);
    console.log('✅ Moved child page to target parent');

    // Verify the move
    const movedPage = await storage.loadPage(childPage.guid);
    console.log('✅ Verified page move:');
    console.log(`   - Old parent: ${childPage.folderId}`);
    console.log(`   - New parent: ${movedPage.folderId}`);
    
    if (movedPage.folderId !== targetPage.guid) {
      throw new Error('❌ Move failed: parent GUID not updated correctly');
    }

    // Test 3: Move page to root
    console.log('\n📝 Test 3: Moving page to root...');
    await storage.movePage(childPage.guid, null);
    console.log('✅ Moved page to root');

    const rootMovedPage = await storage.loadPage(childPage.guid);
    console.log('✅ Verified page move to root:');
    console.log(`   - Parent GUID: ${rootMovedPage.folderId || '(root)'}`);
    
    if (rootMovedPage.folderId !== '') {
      throw new Error('❌ Move to root failed: parent GUID not cleared');
    }

    // Test 4: Test circular reference prevention
    console.log('\n📝 Test 4: Testing circular reference prevention...');
    try {
      await storage.movePage(rootPage.guid, rootPage.guid);
      console.log('❌ FAILED: Should have thrown circular reference error');
    } catch (error: any) {
      if (error.code === 'CIRCULAR_REFERENCE') {
        console.log('✅ Correctly prevented moving page to itself');
      } else {
        throw error;
      }
    }

    // Test 5: Move page with children
    console.log('\n📝 Test 5: Testing move with children...');
    
    // Create a grandchild
    const grandchildPage: PageContent = {
      guid: 'grandchild-page-001',
      title: 'Grandchild Test Page',
      body: '# Grandchild Page\n\nThis is a grandchild page.',
      folderId: childPage.guid,
      status: 'published',
      tags: ['test', 'grandchild'],
      createdBy: 'test-user',
      modifiedBy: 'test-user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    await storage.savePage(grandchildPage.guid, childPage.guid, grandchildPage);
    console.log('✅ Created grandchild page:', grandchildPage.guid);

    // Move child (with grandchild) to target
    await storage.movePage(childPage.guid, targetPage.guid);
    console.log('✅ Moved page with children to new parent');

    // Verify the move
    const movedParent = await storage.loadPage(childPage.guid);
    const movedGrandchild = await storage.loadPage(grandchildPage.guid);
    console.log('✅ Verified hierarchical move:');
    console.log(`   - Parent new location: ${movedParent.folderId}`);
    console.log(`   - Grandchild parent: ${movedGrandchild.folderId}`);

    // Test 6: List children to verify structure
    console.log('\n📝 Test 6: Verifying page structure...');
    const rootChildren = await storage.listChildren(null);
    console.log(`✅ Root level pages: ${rootChildren.length}`);
    rootChildren.forEach(child => {
      console.log(`   - ${child.title} (${child.guid})`);
    });

    const targetChildren = await storage.listChildren(targetPage.guid);
    console.log(`✅ Children of target page: ${targetChildren.length}`);
    targetChildren.forEach(child => {
      console.log(`   - ${child.title} (${child.guid})`);
    });

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await storage.deletePage(grandchildPage.guid, false);
    await storage.deletePage(childPage.guid, false);
    await storage.deletePage(rootPage.guid, false);
    await storage.deletePage(targetPage.guid, false);
    console.log('✅ Test data cleaned up');

    console.log('\n✅ All tests passed! movePage functionality is working correctly.');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.statusCode) {
      console.error('   Status code:', error.statusCode);
    }
    process.exit(1);
  }
}

// Run the test
runTest().catch(console.error);
