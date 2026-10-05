import { describe, it, expect } from 'vitest';
import * as t from '../change-tags.js';

describe('change-tags', () => {
  it('savePage (guid, parentGuid) matches StoragePlugin.savePage', () => {
    expect(t.tagsForSavePage('g', 'p')).toEqual(['page:g', 'children:p', 'children:any', 'ancestors:any', 'backlinks:any']);
    expect(t.tagsForSavePage('g', '')).toContain('children:root');
    expect(t.tagsForSavePage('g', null)).toContain('children:root');
  });
  it('delete / move', () => {
    expect(t.tagsForDeletePage('g')).toEqual(['page:g', 'children:any', 'ancestors:any', 'backlinks:any']);
    expect(t.tagsForMovePage('g', null)).toEqual(['page:g', 'children:root', 'children:any', 'ancestors:any', 'backlinks:any']);
    expect(t.tagsForMovePage('g', 'p')).toContain('children:p');
  });
  it('comments / attachments / page types', () => {
    expect(t.tagsForComments('g')).toEqual(['comments:g']);
    expect(t.tagsForAttachments('g')).toEqual(['attachments:g']);
    expect(t.tagsForPageType('pt')).toEqual(['page-types:list', 'page-type:pt']);
  });
});
