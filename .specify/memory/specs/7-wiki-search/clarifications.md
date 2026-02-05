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
**Question**: What is the "cheapest implementation" for default search? Option A

**Current spec says**: "Default version should be cheapest implementation"

**Needs specific decision**:
- Option A: Simple grep/scan of all markdown files (CPU, no additional service cost)
- Option B: SQLite FTS (Full-Text Search) with local database
- Option C: DynamoDB with basic text search (AWS cost)
- Option D: Client-side search in browser (load all content)
- What defines "cheapest" - dollar cost, development time, or complexity? dollor cost

---

### 2. Search Plugin Interface Definition
**Question**: What does the `ISearchPlugin` interface look like?

**Current spec mentions**: "Plug-in architecture should allow us to add more complex and expensive solutions"

**ANSWERED**: Complete interface defined with best practices

**Implementation**:
```typescript
interface ISearchPlugin {
  // Core search functionality
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // Index management
  indexPage(page: WikiPage): Promise<void>;
  removePage(pageId: string): Promise<void>;
  updateIndex(): Promise<void>;  // Full reindex
  
  // Health and status
  getStatus(): Promise<SearchPluginStatus>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

interface SearchOptions {
  // Pagination
  limit?: number;           // Max results (default: 50)
  offset?: number;          // For pagination (default: 0)
  
  // Filtering
  folder?: string;          // Search within folder
  includeSubfolders?: boolean; // Recursive search (default: true)
  tags?: string[];          // Filter by tags
  author?: string;          // Filter by author
  dateFrom?: Date;          // Modified after
  dateTo?: Date;            // Modified before
  
  // Ranking
  sortBy?: 'relevance' | 'date' | 'title'; // Default: 'relevance'
  sortOrder?: 'asc' | 'desc'; // Default: 'desc'
}

interface SearchResult {
  pageId: string;           // Unique page identifier
  shortCode: string;        // For URL generation
  title: string;            // Page title
  snippet: string;          // Context around match (200-300 chars)
  matchCount: number;       // Total matches in page
  relevanceScore: number;   // 0-100 ranking score
  path: string;             // Full path to page
  modifiedDate: Date;       // Last modified
  author?: string;          // Page author
  tags: string[];           // Page tags
  highlightTerms: string[]; // Terms to highlight in snippet
}

interface SearchPluginStatus {
  name: string;             // Plugin identifier
  version: string;          // Plugin version
  isHealthy: boolean;       // Overall health
  lastIndexed?: Date;       // Last index update
  documentCount: number;    // Pages indexed
  errorMessage?: string;    // If unhealthy
}
```

---

### 3. Search Index Storage Location
**Question**: Where is the search index stored and maintained? search index shuld depend on the implementation of search, for example cheapest will have no index

**Needs clarification**:
- If default is file-based: Local filesystem? S3?
- If using DynamoDB: Separate search table or integrated with metadata?
- Who builds/maintains the index: Background job? On-demand?
- How is index kept in sync with content changes?

---

### 4. Search Result Snippet Generation
**Question**: How are search result snippets generated?

**ANSWERED**: Show title and first match with snippet for each result

**Implementation**:
- Display page title as the main result heading
- Show snippet from the first match only (not multiple matches per page)
- Snippet should include surrounding context for readability
- This applies to all search plugin implementations
- Character count and word boundaries to be determined by implementation

---

### 5. Real-Time Search Performance
**Question**: What are the performance targets for search? depends on implementation, may want faster but more expensive options

**ANSWERED**: Standard performance targets defined, but skip for MVP

**Implementation**:
- Maximum search response time:
  - Default (simple) implementation: 2 seconds
  - Advanced implementations: 500ms target
- Debounce delay for "search as you type": 300ms
- Results per page: User selectable (10, 25, 50, 100)
- Show loading indicator after 200ms if search hasn't completed
- Different performance expectations:
  - Default (file-scan): acceptable up to 2s for 1000 pages
  - Advanced plugins: should target sub-500ms response
- Consider pagination to return first page quickly, then load more
- Error timeout: abort search after 30 seconds to prevent hanging

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
- Should default search support all of these, or just simple? simple for MVP

---

### 7. Search Scope Filter UI
**Question**: Where and how is search scope filter displayed?

**Current spec mentions**: "Search in: [Folder Name]" option

**Needs clarification**:
- Dropdown selector? Checkbox? Radio buttons? dropdown
- Options: "All pages", "Current folder", "Current folder + subfolders"? yes
- Visible by default or hidden in "advanced" options? visible by default
- Persist user's preference or reset each search? persist for session

---

### 8. Search Result Ranking Algorithm
**Question**: How are search results ranked by relevance?

**ANSWERED**: Standard weighted ranking algorithm defined

**Implementation**:
- **Ranking factors** (weighted):
  1. **Title match** (weight: 10x) - highest priority
  2. **Exact phrase match** (weight: 5x) in content
  3. **Heading match** (weight: 3x) - H1-H3 matches
  4. **Match frequency** (weight: 2x) - number of occurrences
  5. **Tag match** (weight: 2x) - search term in tags
  6. **Partial match** (weight: 1x) - base score
  7. **Position bias** - earlier matches score higher
  8. **Recency** (weight: 1.2x) - modified in last 30 days
- **Formula**: `score = Σ(match_type_weight × occurrences × position_factor × recency_factor)`
- **Ranking is fixed** for consistency (not user-configurable)
- **Plugin-specific**: Each plugin can implement its own ranking
  - Default plugin: uses above formula
  - Advanced plugins: can use more sophisticated algorithms (TF-IDF, BM25)
- **Tie-breaker**: Alphabetical by title if scores equal
- **Minimum score threshold**: 0.1 (filter out very weak matches)

---

### 9. Search Highlighting Implementation
**Question**: How is search term highlighting implemented on destination page?

**ANSWERED**: No in-page highlighting or navigation needed

**Implementation**:
- Search returns a list of matching pages with snippets
- Each result shows title and context around the first match
- No highlighting on the actual page when clicked
- No navigation between different hits within a page
- Search is purely for finding which pages contain the search terms
- Users click a result to go directly to that page (no query params needed)

---

### 10. Search Dialog Keyboard Navigation
**Question**: How does keyboard navigation work in search? 

**ANSWERED**: Standard accessibility keyboard shortcuts defined

**Implementation**:
- **Ctrl+K** (or Cmd+K on Mac): Open search dialog from anywhere
- **Up/Down arrows**: Navigate through search results
- **Enter**: Open selected result in current view
- **Ctrl+Enter** (or Cmd+Enter): Open selected result in new tab
- **Escape**: Close search dialog
- **Tab**: Move focus between search input and filters
- **Shift+Tab**: Move focus backwards
- **Home/End**: Jump to first/last result
- **PageUp/PageDown**: Scroll results list
- **Ctrl+A**: Select all text in search input
- **Initial focus**: Search input field when dialog opens
- **Trap focus**: Keep tab navigation within dialog while open
- **Screen reader support**: Announce result count and selection changes

---

### 11. Recent Searches Storage
**Question**: Where are recent searches stored and how long?

**ANSWERED**: LocalStorage with privacy-conscious defaults

**Implementation**:
- Store up to **10 recent searches** per user/device
- Use **localStorage** for persistence across sessions
- Storage key: `bluefin_recent_searches`
- Data format: Array of objects with `{ query: string, timestamp: number }`
- FIFO: Oldest search removed when limit exceeded
- **Clear button**: "Clear recent searches" link in search dialog
- **Privacy consideration**: 
  - Don't store searches in incognito/private mode
  - Consider adding "Don't save this search" checkbox for sensitive queries
- **Auto-cleanup**: Remove searches older than 30 days
- **Per device**: Not synced across devices (avoids privacy concerns)
- Display in dropdown: Most recent first
- Deduplicate: If same query searched again, move to top with new timestamp

---

### 12. No Results Behavior
**Question**: What happens when search returns no results?

**Not explicitly covered in spec**:
- Show message: "No results found for 'xyz'"? yes
- Suggest alternatives: "Did you mean...?" not for MVP
- Show recently viewed pages? no (aligned with Spec #13: no user activity tracking for MVP)
- Link to create new page with search term as title? no

---

### 13. Pagination vs Infinite Scroll
**Question**: Should search results use pagination or infinite scroll?

**Current spec says**: "Showing 1-10 of 150 results" suggests pagination

**Needs clarification**:
- Traditional pagination with page numbers?
- Or "Load more" button (infinite scroll)? infinite scroll
- How many results per page (10, 25, 50)? user selectable
- Should this be user-configurable?

---

### 14. Search Auto-Suggestions Source
**Question**: Where do auto-suggestions come from? no auto-suggestions

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
- Are tags indexed separately or part of full-text index? full-text index
- Can user select tags from a list (tag picker)? no
- Autocomplete for tag names? no
- Case-sensitive tag matching? full text search should be case insensitive
- AND vs OR for multiple tags: "tag:vacation tag:2024"? yes

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Search Filters and Facets
**Question**: What additional search filters should be available?

**Not explicitly covered in spec**:
- Filter by date range (created, modified)? yes
- Filter by author? yes
- Filter by page status (draft, published)? no
- Filter by attachment type (pages with images, PDFs)? no
- Should filters be in sidebar or dropdown? dropdown

---

### 17. Search Analytics and Monitoring
**Question**: Should search queries be logged for analytics? no analytics for MVP

**Not explicitly covered in spec**:
- Track popular search terms?
- Track queries with no results (to improve content)?
- Dashboard for admins showing search stats?
- Privacy implications?

**Aligned with Spec #13 (Dashboard)**: No analytics/statistics for MVP
- No search query logging
- No popular search tracking
- Privacy benefit: No tracking of user search behavior
- Cost savings: No DynamoDB writes per search
- Future enhancement if demand exists

---

### 18. Search Export Results
**Question**: Can users export search results? no

**Not explicitly covered in spec**:
- Export as CSV, JSON, or plain text list?
- Useful for generating reports?
- Include snippets or just links?

---

### 19. Saved Searches
**Question**: Can users save frequently used searches? no

**Not explicitly covered in spec**:
- Save search query with name?
- Quick access to saved searches?
- Shared vs personal saved searches?

---

### 20. Search Within Search (Drill Down)
**Question**: Can users refine search results without starting over? no

**Not explicitly covered in spec**:
- After searching "vacation", add "2024" to narrow results?
- Keep previous results and filter further?
- Or start new search each time?

---

### 21. Advanced Search UI
**Question**: Should there be an advanced search form? not for mvp

**Not explicitly covered in spec**:
- Form with separate fields: title, content, tags, author, date range?
- Or just power users using query syntax?
- Where to access advanced search?

---

### 22. Search Indexing Frequency
**Question**: How often is search index updated? dependent on the search implementation

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
- Show snippet from best match only? yes

---

### 24. Search Language and Stemming
**Question**: Does search support language-specific features?

**ANSWERED**: Basic English support for default, plugin-dependent for advanced

**Implementation**:
- **Default (simple) plugin**:
  - Case-insensitive matching
  - Basic English stemming optional (adds complexity)
  - No stop words filtering initially (keep it simple)
- **Advanced plugins**: Can implement sophisticated NLP
  - Porter/Snowball stemming (search "running" finds "run", "ran", "runner")
  - Stop words filtering ("the", "and", "or", "a")
  - Synonym expansion
  - Multi-language support (Spanish, French, etc.)
  - Language detection
- **Recommendation for default**: Skip stemming for MVP to keep simple
  - Users can type multiple forms: "run OR running OR ran"
  - Avoids false positives from aggressive stemming
- **Best practice**: Document which features each plugin supports
- **Character handling**: 
  - Normalize accented characters (é → e) for better matching
  - Support Unicode for international names

---

### 25. Search API for External Tools
**Question**: Should search be accessible via API? no api for external tools for mvp

**Not explicitly covered in spec**:
- REST API endpoint for search?
- Useful for mobile app, CLI tools, integrations?
- Rate limiting for API access?

---

### 26. Error Handling and Resilience
**Question**: How should search handle errors gracefully?

**BEST PRACTICE**: Comprehensive error handling strategy

**Implementation**:
- **Network errors**: Show "Search temporarily unavailable" with retry button
- **Timeout errors**: "Search taking too long, try a more specific query"
- **Index corruption**: Automatic fallback to basic file scan if advanced plugin fails
- **Partial results**: If search times out, show what was found with "Results may be incomplete"
- **Plugin failure**: Graceful degradation to default search implementation
- **User feedback**: Non-blocking error messages that don't prevent continued work
- **Logging**: Log all search errors for debugging (query, plugin, error type, timestamp)
- **Circuit breaker**: Temporarily disable failing plugin after N consecutive errors
- **Validation**: Sanitize search queries to prevent injection attacks
- **Empty query**: Show helpful message "Enter search terms" rather than error
- **Too many results**: Warn if results exceed 10,000 with suggestion to refine query

---

### 27. Search Security and Input Sanitization
**Question**: How is search protected against malicious input?

**BEST PRACTICE**: Defense in depth security approach

**Implementation**:
- **Input validation**:
  - Max query length: 500 characters
  - Strip/escape special characters that could cause injection
  - Prevent regex DOS attacks (catastrophic backtracking)
- **SQL injection prevention** (if using SQL-based plugin):
  - Use parameterized queries always
  - Never concatenate user input into SQL
- **XSS prevention**:
  - Sanitize snippets before displaying
  - HTML-encode all user-generated content in results
- **Rate limiting**:
  - Max 60 searches per minute per user (prevent DoS)
  - Exponential backoff after rate limit hit
- **Access control**:
  - Search only returns pages user has permission to view
  - Folder-scoped searches respect folder permissions
- **Audit trail**:
  - Log all searches with user ID for security monitoring
  - Alert on suspicious patterns (automated scraping, SQL injection attempts)

---

### 28. Search Snippet Generation Strategy
**Question**: How are snippets optimally generated?

**BEST PRACTICE**: Smart context-aware snippet extraction

**Implementation**:
- **Snippet length**: 200-300 characters (approximately 2-3 lines)
- **Context window**: Include 50 chars before and after match
- **Word boundaries**: Never cut mid-word, trim to nearest space
- **Multiple matches**: Show snippet from first/best match only
- **Highlight terms**: Bold or highlight actual search terms in snippet
- **Ellipsis**: Use "..." to indicate truncated content
- **Sentence preference**: Try to show complete sentences when possible
- **HTML stripping**: Remove markdown/HTML formatting from snippets
- **Special cases**:
  - Title match: Show page title + beginning of content
  - No content match: Show first 200 chars of page
  - Code blocks: Format code snippet appropriately with syntax hint
- **Unicode handling**: Properly handle multi-byte characters
- **Whitespace normalization**: Collapse multiple spaces/newlines

---

### 29. Search Index Optimization
**Question**: How can search index be optimized for performance?

**BEST PRACTICE**: Efficient indexing strategies

**Implementation**:
- **Incremental indexing**: Only reindex changed pages, not entire wiki
- **Batch processing**: Index multiple pages in single transaction
- **Background tasks**: Index updates run async, don't block UI
- **Smart scheduling**: Index during low-traffic periods if possible
- **Index compression**: Use efficient storage formats (protobuf, messagepack)
- **Partial updates**: Update single fields without full reindex
- **Memory efficiency**: Stream large files rather than loading entirely
- **Cache strategy**:
  - Cache parsed markdown to avoid repeated parsing
  - Cache shortcode mappings for quick result URL generation
  - Invalidate cache on page updates
- **Index metadata**: Store file hash to detect actual changes
- **Exclude patterns**: Don't index hidden files, temp files, backup files
- **Progress feedback**: Show indexing progress for manual reindex
- **Index versioning**: Support migrating to new index schema

---

### 30. Search Accessibility (A11y) Requirements
**Question**: How is search made accessible to all users?

**BEST PRACTICE**: WCAG 2.1 Level AA compliance

**Implementation**:
- **ARIA labels**: Proper labels for search input, results, filters
- **Screen reader announcements**:
  - "X results found for 'query'"
  - "Navigated to result Y of X"
  - "Loading search results..."
- **Keyboard navigation**: Full functionality without mouse (already covered in Q10)
- **Focus management**:
  - Clear visible focus indicators
  - Return focus to trigger element when dialog closes
  - Logical tab order
- **Color contrast**: Search UI meets 4.5:1 contrast ratio minimum
- **Motion**: Respect prefers-reduced-motion for animations
- **Text sizing**: Interface works at 200% zoom
- **Error messages**: Clearly associated with input fields
- **Landmarks**: Use semantic HTML (main, navigation, search regions)
- **Skip links**: Allow skipping repeated search UI elements
- **Voice control**: Ensure voice commands can trigger search

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially default search implementation choice ✓
2. **Design the search plugin interface completely** - this enables pluggability ✓
3. **Prototype the default search implementation** - validate performance with realistic data size
4. **Create search UI mockups** - dialog layout, results display, filters
5. **Implement security measures** - input validation, rate limiting, access control ✓
6. **Plan error handling** - graceful degradation, user feedback ✓
7. **Design accessibility** - keyboard nav, screen readers, WCAG compliance ✓
8. **Optimize indexing strategy** - incremental updates, efficient storage ✓
9. **Test with realistic data** - 1000+ pages, various content types, edge cases
10. **Document plugin development** - Guide for creating custom search plugins

## 🎯 MVP Implementation Priority

**Phase 1 - Core Search** (Critical):
- Default file-scan search plugin
- Basic search dialog UI with results
- Simple text matching (case-insensitive)
- Snippet generation with context
- Keyboard navigation (Ctrl+K to open)

**Phase 2 - Enhanced UX** (High Priority):
- Recent searches (localStorage)
- Folder-scoped search with dropdown
- Loading indicators and error messages
- Result pagination/infinite scroll
- Basic ranking (title > content)

**Phase 3 - Polish** (Medium Priority):
- Filter by date/author
- Sort options (relevance/date/title)
- Security: input validation, rate limiting
- Accessibility improvements
- Performance optimization

**Phase 4 - Advanced** (Future):
- Plugin system for advanced search engines
- Tag-based filtering
- Advanced query syntax (Boolean, phrase)
- Search analytics (if privacy allows)
- API access for integrations

Would you like me to:
- Create implementation tasks for Phase 1?
- Design the default file-scan plugin architecture?
- Create mockups for the search dialog and results?
- Write unit test scenarios for search functionality?
