# Clarification Questions: Wiki Search

**Feature**: Wiki Search with Pluggable Architecture  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

### NEW: Search Result URL Structure
**Question**: How are search result links structured?

**ANSWERED**: Search results use short-code GUID URLs

**Implementation**:
- Result link format: `/pages/{short-code}/Page Title`
- Search highlighting via query param: `?highlight=search+terms`
- Full example: `/pages/abc-123/Getting Started?highlight=installation+guide`
- URL mapping service resolves short-code to S3 path
- Page renames don't break saved search links
- Search index can cache short-code mappings for performance

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Default Search Implementation Choice
**Question**: What is the "cheapest implementation" for default search?

**Current spec says**: "Default version should be cheapest implementation"

**Needs specific decision**:
- Option A: Simple grep/scan of all markdown files (CPU, no additional service cost)
- Option B: SQLite FTS (Full-Text Search) with local database
- Option C: DynamoDB with basic text search (AWS cost)
- Option D: Client-side search in browser (load all content)
- What defines "cheapest" - dollar cost, development time, or complexity?

---

### 2. Search Plugin Interface Definition
**Question**: What does the `ISearchPlugin` interface look like?

**Current spec mentions**: "Plug-in architecture should allow us to add more complex and expensive solutions"

**Needs complete interface**:
```typescript
interface ISearchPlugin {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  indexPage(page: WikiPage): Promise<void>;
  removePage(pageId: string): Promise<void>;
  updateIndex(): Promise<void>;  // Full reindex?
  // What else?
}
```
- Is this correct?
- What are SearchOptions and SearchResult schemas?

---

### 3. Search Index Storage Location
**Question**: Where is the search index stored and maintained?

**Needs clarification**:
- If default is file-based: Local filesystem? S3?
- If using DynamoDB: Separate search table or integrated with metadata?
- Who builds/maintains the index: Background job? On-demand?
- How is index kept in sync with content changes?

---

### 4. Search Result Snippet Generation
**Question**: How are search result snippets generated?

**Current spec says**: "Snippet showing where the query appears"

**Needs clarification**:
- How many characters before/after the match?
- How many snippets per page (first match only, or top 3)?
- Should snippet respect word boundaries?
- Strip markdown formatting or show it?
- How is relevance determined for snippet selection?

---

### 5. Real-Time Search Performance
**Question**: What are the performance targets for search?

**Current spec says**: "Results appear below the input showing matching pages"

**Needs clarification**:
- Maximum search response time: 500ms? 1 second? 2 seconds?
- Debounce delay for "search as you type": 300ms? 500ms?
- How many results to return by default?
- Should there be "search still loading" indicator for slow queries?
- Different performance expectations for default vs advanced search plugins?

---

## 🟡 High Priority - Important for User Experience

### 6. Search Query Syntax
**Question**: What search query syntax should be supported?

**Current spec mentions**: Basic text search, but what about advanced?

**Needs clarification**:
- Simple: "family vacation" (all words)
- Phrase: "family vacation" in quotes (exact phrase)
- Boolean: "family AND vacation", "chicken OR beef"
- Wildcard: "vaca*" (vacation, vacations)
- Exclusion: "vacation -planning"
- Should default search support all of these, or just simple?

---

### 7. Search Scope Filter UI
**Question**: Where and how is search scope filter displayed?

**Current spec mentions**: "Search in: [Folder Name]" option

**Needs clarification**:
- Dropdown selector? Checkbox? Radio buttons?
- Options: "All pages", "Current folder", "Current folder + subfolders"?
- Visible by default or hidden in "advanced" options?
- Persist user's preference or reset each search?

---

### 8. Search Result Ranking Algorithm
**Question**: How are search results ranked by relevance?

**Current spec says**: "Ranked by relevance (most matches first by default)"

**Needs clarification**:
- Just match count, or weighted by:
  - Title match > content match
  - Exact match > partial match
  - Newer pages > older pages
  - Shorter pages > longer pages
- Should ranking be configurable or fixed?
- Different ranking for different search plugins?

---

### 9. Search Highlighting Implementation
**Question**: How is search term highlighting implemented on destination page?

**ANSWERED**: Using query string parameter with short-code URLs

**Implementation**:
- Format: `/pages/{short-code}/Page Title?highlight=term1+term2`
- Multiple terms space-separated in query param
- Highlights persist until page refresh or navigation away
- Frontend JavaScript parses query param and highlights matches
- Same highlight color for all terms (or alternating colors)
- Clear highlights button in UI optional

---

### 10. Search Dialog Keyboard Navigation
**Question**: How does keyboard navigation work in search?

**Current spec mentions**: "Down arrow allows selecting suggestions"

**Needs complete definition**:
- Up/Down: Navigate results
- Enter: Open selected result
- Escape: Close search dialog
- Tab: Move between search input and filters?
- Ctrl+K: Open search dialog?
- What else?

---

### 11. Recent Searches Storage
**Question**: Where are recent searches stored and how long?

**Current spec says**: "Persist across browser sessions (localStorage)"

**Needs clarification**:
- How many recent searches to keep (5, 10, 20)?
- Per user or per device?
- Can user clear recent searches?
- Privacy consideration - sensitive search terms?

---

### 12. No Results Behavior
**Question**: What happens when search returns no results?

**Not explicitly covered in spec**:
- Show message: "No results found for 'xyz'"?
- Suggest alternatives: "Did you mean...?"
- Show recently viewed pages?
- Link to create new page with search term as title?

---

### 13. Pagination vs Infinite Scroll
**Question**: Should search results use pagination or infinite scroll?

**Current spec says**: "Showing 1-10 of 150 results" suggests pagination

**Needs clarification**:
- Traditional pagination with page numbers?
- Or "Load more" button (infinite scroll)?
- How many results per page (10, 25, 50)?
- Should this be user-configurable?

---

### 14. Search Auto-Suggestions Source
**Question**: Where do auto-suggestions come from?

**Current spec says**: "Suggestions dropdown appears with matching page titles"

**Needs clarification**:
- Only page titles, or also recent searches?
- Should it include partial content matches?
- Should it include frequently visited pages?
- Weighted by recency, popularity, or alphabetical?

---

### 15. Tag Search Implementation
**Question**: How is tag-based search integrated?

**Current spec mentions**: "Search 'tag:vacation'" as syntax

**Needs clarification**:
- Are tags indexed separately or part of full-text index?
- Can user select tags from a list (tag picker)?
- Autocomplete for tag names?
- Case-sensitive tag matching?
- AND vs OR for multiple tags: "tag:vacation tag:2024"?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Search Filters and Facets
**Question**: What additional search filters should be available?

**Not explicitly covered in spec**:
- Filter by date range (created, modified)?
- Filter by author?
- Filter by page status (draft, published)?
- Filter by attachment type (pages with images, PDFs)?
- Should filters be in sidebar or dropdown?

---

### 17. Search Analytics and Monitoring
**Question**: Should search queries be logged for analytics?

**Not explicitly covered in spec**:
- Track popular search terms?
- Track queries with no results (to improve content)?
- Dashboard for admins showing search stats?
- Privacy implications?

---

### 18. Search Export Results
**Question**: Can users export search results?

**Not explicitly covered in spec**:
- Export as CSV, JSON, or plain text list?
- Useful for generating reports?
- Include snippets or just links?

---

### 19. Saved Searches
**Question**: Can users save frequently used searches?

**Not explicitly covered in spec**:
- Save search query with name?
- Quick access to saved searches?
- Shared vs personal saved searches?

---

### 20. Search Within Search (Drill Down)
**Question**: Can users refine search results without starting over?

**Not explicitly covered in spec**:
- After searching "vacation", add "2024" to narrow results?
- Keep previous results and filter further?
- Or start new search each time?

---

### 21. Advanced Search UI
**Question**: Should there be an advanced search form?

**Not explicitly covered in spec**:
- Form with separate fields: title, content, tags, author, date range?
- Or just power users using query syntax?
- Where to access advanced search?

---

### 22. Search Indexing Frequency
**Question**: How often is search index updated?

**Not explicitly covered in spec**:
- Real-time on every page save?
- Background job every X minutes?
- Manual reindex by admin?
- Different strategy for default vs advanced plugins?

---

### 23. Search Result Deduplication
**Question**: If same page matches multiple times, how is it displayed?

**Not explicitly covered in spec**:
- Show once with multiple snippets?
- Or once with combined relevance score?
- Show snippet from best match only?

---

### 24. Search Language and Stemming
**Question**: Does search support language-specific features?

**Not explicitly covered in spec**:
- English stemming (search "running" finds "run", "ran")?
- Multi-language support for international families?
- Stop words filtering ("the", "and", "or")?
- Is this plugin-dependent?

---

### 25. Search API for External Tools
**Question**: Should search be accessible via API?

**Not explicitly covered in spec**:
- REST API endpoint for search?
- Useful for mobile app, CLI tools, integrations?
- Rate limiting for API access?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially default search implementation choice
2. **Design the search plugin interface completely** - this enables pluggability
3. **Prototype the default search implementation** - validate performance with realistic data size
4. **Create search UI mockups** - dialog layout, results display, filters

Would you like me to:
- Research and compare default search implementation options?
- Design the complete ISearchPlugin interface?
- Create mockups for the search dialog and results?
- Help decide on ranking algorithm?
