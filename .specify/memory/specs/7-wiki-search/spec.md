# Feature Specification: Wiki Search with Pluggable Architecture

**Feature Branch**: `7-wiki-search`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "ability to search, default version should be cheapest implementation. plug-in architecture should allow us to add more complex and expensive solutions optionally"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Text Search Across All Pages (Priority: P1)

A user can enter a search query and receive a list of matching pages with snippets showing where the query appears, using the default cost-effective search implementation.

**Why this priority**: Search is fundamental to wiki usability. Users need to find content quickly. Default implementation must work out-of-box with minimal cost.

**Independent Test**: Type "family vacation" in search box, press Enter, verify results show all pages containing those words with highlighted snippets, and click a result to navigate to that page.

**Acceptance Scenarios**:

1. **Given** a user is on any page, **When** they click the search icon or press Ctrl+K, **Then** a search input dialog opens
2. **Given** search input is focused, **When** user types query "vacation", **Then** results appear below the input showing matching pages
3. **Given** search results are displayed, **When** shown, **Then** each result includes page title, relevance score/match count, and snippet with highlighted query terms
4. **Given** multiple pages match, **When** results are shown, **Then** they are ranked by relevance (most matches first by default)
5. **Given** a search result, **When** clicked, **Then** user navigates to that page and search term is highlighted in content

---

### User Story 2 - Search Within Current Folder/Hierarchy (Priority: P2)

A user can limit search to the current folder and its subfolders, making it easier to find content within a specific section of the wiki.

**Why this priority**: Scoped search improves precision but isn't essential for MVP. Users can scan full results as workaround.

**Independent Test**: Navigate to "Recipes" folder, open search, check "Search in current folder only", search for "chicken", and verify only pages under Recipes folder appear in results.

**Acceptance Scenarios**:

1. **Given** a user is viewing a page in a folder, **When** they open search, **Then** a "Search in: [Folder Name]" option appears
2. **Given** scoped search option, **When** enabled, **Then** search queries only return results from current folder and descendants
3. **Given** scoped search is active, **When** user navigates to root, **Then** scope changes to "Search all pages"
4. **Given** scoped search results, **When** displayed, **Then** folder path is shown for each result
5. **Given** scoped search preference, **When** set, **Then** it persists across search sessions until changed

---

### User Story 3 - Search by Page Title Only (Priority: P2)

A user can filter search to match page titles only (ignoring content), useful for quickly navigating to known pages.

**Why this priority**: Title-only search is a common quick-navigation pattern but not essential. Full-text search works as fallback.

**Independent Test**: Open search, select "Titles only" filter, type "Getting Started", verify only pages with "Getting Started" in title appear (not pages that mention it in content).

**Acceptance Scenarios**:

1. **Given** search dialog is open, **When** user clicks "Titles only" toggle, **Then** search filters to page titles
2. **Given** title-only search, **When** query matches page title, **Then** result is returned regardless of content
3. **Given** title-only search, **When** query only matches content, **Then** result is NOT returned
4. **Given** title-only results, **When** displayed, **Then** exact title matches rank higher than partial matches
5. **Given** title-only mode, **When** toggled off, **Then** search reverts to full-text content search

---

### User Story 4 - Search Results with Pagination (Priority: P2)

A user can browse through search results using pagination when many pages match, preventing overwhelming result lists.

**Why this priority**: Important for usability with large result sets but not critical for MVP with small wikis.

**Independent Test**: Search for common word "the", verify results show "Showing 1-10 of 150 results", click "Next" to see results 11-20.

**Acceptance Scenarios**:

1. **Given** search returns more than 10 results, **When** displayed, **Then** only first 10 are shown with pagination controls
2. **Given** paginated results, **When** user clicks "Next", **Then** next 10 results load
3. **Given** paginated results, **When** on page 3, **Then** user can click "Previous" to go back
4. **Given** pagination controls, **When** shown, **Then** current page and total count are displayed (e.g., "Page 2 of 15")
5. **Given** new search query, **When** entered, **Then** pagination resets to page 1

---

### User Story 5 - Recent Searches History (Priority: P3)

A user can see their recent search queries and quickly re-run them, improving efficiency for repeated searches.

**Why this priority**: Convenient but not essential. Users can retype queries as workaround.

**Independent Test**: Search for "vacation", close search, open search again, and verify "vacation" appears in recent searches dropdown.

**Acceptance Scenarios**:

1. **Given** search dialog is opened, **When** input is focused, **Then** dropdown shows last 5 search queries
2. **Given** recent searches dropdown, **When** user clicks a query, **Then** search executes immediately
3. **Given** recent searches, **When** stored, **Then** they persist across browser sessions (localStorage)
4. **Given** recent searches list is full, **When** new search is performed, **Then** oldest query is removed
5. **Given** recent searches dropdown, **When** user hovers over query, **Then** an "X" button appears to remove it from history

---

### User Story 6 - Search Auto-Suggestions (Priority: P3)

As a user types in the search box, relevant page titles appear as suggestions, enabling quick navigation without viewing full results.

**Why this priority**: Nice UX improvement but not essential. Users can complete typing and view results.

**Independent Test**: Type "fam" in search box, verify dropdown shows suggestions like "Family Tree", "Family Photos", "Family Recipes" before completing the word.

**Acceptance Scenarios**:

1. **Given** user types in search input, **When** 3+ characters are entered, **Then** suggestions dropdown appears with matching page titles
2. **Given** suggestions dropdown, **When** displayed, **Then** shows up to 5 most relevant matches
3. **Given** suggestions, **When** user clicks a suggestion, **Then** navigates directly to that page (no search results page)
4. **Given** suggestions, **When** user continues typing, **Then** suggestions update in real-time
5. **Given** suggestions dropdown, **When** user presses Down arrow, **Then** keyboard navigation allows selecting suggestions

---

### User Story 7 - Tag-Based Search (Priority: P3)

A user can search for pages by tags (from page metadata), finding all pages tagged with specific topics.

**Why this priority**: Useful for organization but not essential. Full-text search can find tag names in content.

**Independent Test**: Search "tag:recipes", verify all pages with "recipes" tag appear regardless of whether "recipes" appears in content.

**Acceptance Scenarios**:

1. **Given** a user enters query "tag:vacation", **When** search executes, **Then** results show all pages with "vacation" tag
2. **Given** tag search syntax, **When** used, **Then** system recognizes "tag:" prefix and filters accordingly
3. **Given** multiple tags on page, **When** any tag matches, **Then** page appears in results
4. **Given** tag search, **When** combined with text query (e.g., "tag:recipes chicken"), **Then** results must match both tag AND text
5. **Given** tag search results, **When** displayed, **Then** matched tags are highlighted in result snippets

---

### User Story 8 - Search Result Highlighting on Page (Priority: P3)

When a user navigates to a page from search results, the search terms are highlighted in the page content, making it easy to find relevant sections.

**Why this priority**: Helpful for quickly locating context but not essential. Users can Ctrl+F as workaround.

**Independent Test**: Search "chicken recipe", click a result, verify "chicken" and "recipe" are highlighted in yellow on the page.

**Acceptance Scenarios**:

1. **Given** user clicks a search result, **When** page loads, **Then** all instances of search terms are highlighted
2. **Given** highlighted terms, **When** shown, **Then** they use distinct background color (e.g., yellow) without obscuring text
3. **Given** multiple term instances, **When** highlighted, **Then** page scrolls to first occurrence
4. **Given** highlighted page, **When** user clicks "Clear highlights" button, **Then** highlights are removed
5. **Given** highlights active, **When** user navigates away and returns, **Then** highlights are cleared (not persistent)

---

### User Story 9 - Search Index Updates Automatically (Priority: P1)

When a page is created, updated, or deleted, the search index updates automatically so search results are always current.

**Why this priority**: Essential for search accuracy. Stale results undermine user trust in search functionality.

**Independent Test**: Create new page "Test Page" with content "unique term xyz123", immediately search "xyz123", and verify new page appears in results.

**Acceptance Scenarios**:

1. **Given** a page is created, **When** save completes, **Then** page is indexed and searchable within 5 seconds
2. **Given** a page is updated, **When** changes are saved, **Then** search index updates to reflect new content within 5 seconds
3. **Given** a page is deleted, **When** deletion completes, **Then** page is removed from search index within 5 seconds
4. **Given** search index updates, **When** processing, **Then** they occur in background without blocking user actions
5. **Given** index update fails, **When** error occurs, **Then** system logs error and retries (eventual consistency acceptable)

---

### User Story 10 - Pluggable Search Provider Architecture (Priority: P1)

The system uses a default cost-effective search implementation (DynamoDB scan or simple index) but allows administrators to plug in advanced search providers (Algolia, Elasticsearch, MeiliSearch) for better performance and features.

**Why this priority**: Core architectural requirement. Enables starting cheap and upgrading as needs grow without code rewrites.

**Independent Test**: System runs with default DynamoDB search provider, administrator installs MeiliSearch plugin via configuration, restarts system, and search now uses MeiliSearch with improved speed and features.

**Acceptance Scenarios**:

1. **Given** no search provider is configured, **When** system initializes, **Then** default DynamoDB search provider activates automatically
2. **Given** ISearchProvider interface, **When** implemented by plugin, **Then** it provides methods: indexPage(), search(), deletePage(), reindexAll()
3. **Given** search provider plugin is installed, **When** configured in settings, **Then** system uses plugin instead of default provider
4. **Given** multiple search providers available, **When** switching providers, **Then** reindexAll() is called to populate new provider's index
5. **Given** search provider fails, **When** error occurs, **Then** system falls back to default provider or shows graceful error (no crash)

---

### Edge Cases

- What happens when search query is empty or only whitespace? No results are shown, or prompt appears: "Enter search query".
- What happens when no pages match search query? Message displays: "No results found for 'query'. Try different keywords."
- What happens when search query contains special characters (e.g., quotes, asterisks)? Characters are escaped/sanitized to prevent injection; treated as literal text in basic search.
- What happens when searching for very common words (e.g., "the", "a")? Results may be numerous; pagination helps; advanced providers may use stop-words to filter.
- What happens when search query is extremely long (1000+ characters)? Query is truncated to reasonable length (e.g., 200 chars) with warning.
- What happens when user has no permission to view a page that matches? Page is excluded from search results (security: search respects permissions).
- What happens when search index is out of sync with actual pages? Reindex operation can be triggered manually by admin; eventual consistency acceptable for default provider.
- What happens when search query contains markdown syntax? Syntax is treated as literal text, not parsed; search matches page content as stored.
- What happens when switching search providers mid-operation? Current search completes with old provider; subsequent searches use new provider after reindex.
- What happens when search provider plugin crashes? Error is logged, system falls back to default provider, user sees degraded search but not complete failure.
- What happens when searching across 1000+ pages with basic provider? Performance may be slow (5-10s); pagination helps; recommendation to upgrade to advanced provider shown.
- What happens when user searches immediately after creating page? Page may not appear in results for up to 5 seconds (indexing delay); acceptable for eventual consistency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement ISearchProvider interface for pluggable search architecture
- **FR-002**: System MUST provide default search implementation using DynamoDB scan or basic inverted index (cost-effective, <$1/month)
- **FR-003**: System MUST support full-text search across all page content (markdown body)
- **FR-004**: System MUST support search across page titles and metadata (tags, description)
- **FR-005**: System MUST return search results with page title, snippet (150 chars), and relevance score
- **FR-006**: System MUST highlight matching terms in result snippets
- **FR-007**: System MUST rank results by relevance (default: match count, optionally TF-IDF or provider-specific)
- **FR-008**: System MUST support case-insensitive search by default
- **FR-009**: System MUST support partial word matching (e.g., "recip" matches "recipe")
- **FR-010**: System MUST index pages automatically on create, update, delete operations
- **FR-011**: System MUST complete index updates within 5 seconds of page change (eventual consistency acceptable)
- **FR-012**: System MUST provide search UI accessible via keyboard shortcut (Ctrl+K or Cmd+K)
- **FR-013**: System MUST display search results in paginated format (10 results per page)
- **FR-014**: System MUST respect page permissions in search results (users only see pages they can access)
- **FR-015**: System MUST sanitize search queries to prevent injection attacks (SQL injection, XSS)
- **FR-016**: System MUST support search scoped to current folder and descendants (P2 feature)
- **FR-017**: System MUST support title-only search filter (P2 feature)
- **FR-018**: System MUST store recent search queries in browser storage (P3 feature, last 5 queries)
- **FR-019**: System MUST provide search auto-suggestions based on page titles (P3 feature)
- **FR-020**: System MUST support tag-based search with "tag:" prefix syntax (P3 feature)
- **FR-021**: System MUST highlight search terms on destination page when navigating from results (P3 feature)
- **FR-022**: System MUST provide reindexAll() operation for administrators to rebuild search index
- **FR-023**: System MUST log search queries for analytics (optional, privacy-respecting)
- **FR-024**: System MUST return search results within 1 second for default provider (up to 500 pages)
- **FR-025**: System MUST support hot-swapping search providers via configuration without data loss

### Key Entities

- **SearchQuery**: Represents a user's search request
  - Attributes: queryText, scope (all/folder), titleOnly (boolean), tags (array), userId, timestamp
  - Storage: Transient (not persisted), optionally logged to analytics table
  - Relationships: One user per query, may target one folder scope

- **SearchResult**: Represents a single page matching search query
  - Attributes: pageId, pageTitle, snippet (excerpt with matches), relevanceScore, matchCount, highlightedTerms (array)
  - Storage: Computed on-demand from index
  - Relationships: Belongs to one page, part of one SearchResultSet

- **SearchResultSet**: Collection of results for a query
  - Attributes: queryText, totalResults, results (array of SearchResult), page (pagination), executionTime
  - Storage: Transient (returned by API)
  - Relationships: Contains multiple SearchResults

- **SearchIndex**: Represents the indexed content for search
  - Attributes: pageId, pageTitle, contentTokens (array of words), tags, lastIndexed, wordCount
  - Storage: DynamoDB table (default provider) or provider-specific storage
  - Relationships: One-to-one with page

- **SearchProvider**: Plugin implementing search functionality
  - Attributes: providerName, version, capabilities (fuzzy search, faceting, etc.), cost (estimated monthly)
  - Storage: Plugin configuration in settings
  - Relationships: Implements ISearchProvider interface

### ISearchProvider Interface

```typescript
interface ISearchProvider extends IModule {
  // Index a page (create or update)
  indexPage(page: {
    pageId: string;
    title: string;
    content: string;
    tags: string[];
    metadata: Record<string, any>;
  }): Promise<void>;

  // Search for pages
  search(query: {
    text: string;
    scope?: string; // folder ID to limit search
    titleOnly?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<SearchResultSet>;

  // Remove page from index
  deletePage(pageId: string): Promise<void>;

  // Rebuild entire index from scratch
  reindexAll(pages: Array<{
    pageId: string;
    title: string;
    content: string;
    tags: string[];
    metadata: Record<string, any>;
  }>): Promise<void>;

  // Get provider-specific capabilities
  getCapabilities(): {
    fuzzySearch: boolean;
    faceting: boolean;
    highlighting: boolean;
    maxIndexSize: number;
    estimatedMonthlyCost: number;
  };
}
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Search results return within 1 second for queries on wikis with up to 500 pages using default provider
- **SC-002**: Search results return within 500ms for queries on wikis with up to 5000 pages using advanced provider (Algolia, etc.)
- **SC-003**: Search index updates within 5 seconds of page create/update/delete operations 100% of the time
- **SC-004**: Search query sanitization prevents 100% of injection attacks (XSS, SQL injection)
- **SC-005**: Search respects permissions 100% of the time (users cannot find pages they don't have access to)
- **SC-006**: Default search provider costs less than $1/month for typical family wiki (500 pages, 100 searches/day)
- **SC-007**: Search UI opens within 300ms when triggered by Ctrl+K shortcut
- **SC-008**: Search auto-suggestions appear within 200ms of typing (P3 feature)
- **SC-009**: Relevance ranking returns expected "best match" in top 3 results for 90% of test queries
- **SC-010**: Partial word matching works correctly (e.g., "vacat" finds "vacation") 95% of the time
- **SC-011**: Search highlights appear on destination page within 500ms of navigation (P3 feature)
- **SC-012**: ReindexAll operation completes within 1 minute for 500-page wiki
- **SC-013**: Search provider hot-swap completes successfully with no data loss 100% of the time
- **SC-014**: Search pagination loads subsequent pages within 500ms
- **SC-015**: Search functionality works correctly on mobile browsers (responsive UI, touch-friendly)

## Assumptions

- Search index can be eventually consistent (5-second delay acceptable for new content)
- DynamoDB scan is acceptable for default implementation given small wiki size (<1000 pages)
- Full-text search on markdown content is sufficient (no need to parse/index rendered HTML initially)
- Search query volume is low (<1000 queries/day) for family wiki use case
- Advanced search features (fuzzy matching, synonym expansion) can wait for plugin providers
- Page permissions are checked during search result generation (not during indexing)
- Search index can be rebuilt from scratch if corrupted (reindexAll operation)
- Browser localStorage is available for storing recent searches
- Search UI is a modal/dialog overlay, not a dedicated search results page initially
- Markdown content is indexed as plain text (code blocks, inline code treated as searchable text)
- Attachment content is NOT indexed (only filenames); future enhancement
- Search does not require natural language processing (NLP) or semantic search for MVP
- Users accept slight delay in search index updates (not real-time)
- Search provider plugins follow same module loading pattern as storage/auth providers

## Out of Scope

The following are explicitly **not** included in this specification:

- Searching within attachment content (PDFs, documents) (future enhancement)
- Advanced query syntax (boolean operators: AND, OR, NOT) in default provider (advanced providers may support)
- Faceted search/filtering by multiple dimensions simultaneously (future enhancement)
- Search result clustering or categorization (future enhancement)
- Personalized/AI-powered search ranking based on user behavior (future enhancement)
- Search analytics dashboard showing popular queries, zero-result queries (future feature)
- Voice search or speech-to-text input (future enhancement)
- Saved searches or search alerts (future enhancement)
- Search within specific date ranges (future enhancement)
- Multilingual search or language detection (future enhancement)
- Search across multiple wikis in multi-tenant scenario (future enhancement)
- Full markdown parsing to exclude code blocks or special syntax from search (future optimization)
- OCR or image content search (future enhancement)
- Synonym expansion or "did you mean?" suggestions in default provider (future enhancement)
- Real-time collaborative search (multiple users seeing same results) (future enhancement)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Pluggable Architecture (Non-Negotiable #1)**: ISearchProvider interface enables swapping search implementations
- **Cost-Effectiveness (Non-Negotiable #3)**: Default DynamoDB provider costs <$1/month, well within $5 budget
- **Simplicity (Principle III)**: Basic search works out-of-box; complexity is optional via plugins
- **Family-Friendly (Principle IV)**: Easy-to-use search helps non-technical family members find content
- **Performance (Principle II)**: Search returns results within 1 second for typical usage
- **Security (Principle I)**: Search respects permissions, sanitizes queries, prevents unauthorized access

## Technical Notes

### Default Search Provider: DynamoDB Implementation

**Cost Analysis**:
- DynamoDB table: On-demand pricing
- 500 pages × 2KB avg = 1MB storage = $0.25/month
- 100 searches/day × 30 = 3000 reads/month = $0.25/month
- **Total: ~$0.50/month**

**Implementation Strategy**:
```typescript
// DynamoDB table structure
{
  PK: "PAGE#<pageId>",
  SK: "INDEX",
  pageId: string,
  title: string,
  titleLower: string, // for case-insensitive search
  contentTokens: string[], // words from content
  tags: string[],
  wordCount: number,
  lastIndexed: timestamp
}

// Search implementation (simplified)
async search(query: SearchQuery): Promise<SearchResultSet> {
  // Scan DynamoDB (acceptable for <1000 pages)
  const items = await dynamodb.scan({
    TableName: 'WikiSearchIndex',
    FilterExpression: 'contains(titleLower, :q) OR contains(contentTokens, :q)',
    ExpressionAttributeValues: {
      ':q': query.text.toLowerCase()
    }
  });
  
  // Rank by match count (simple relevance)
  const results = items.Items.map(item => ({
    pageId: item.pageId,
    pageTitle: item.title,
    relevanceScore: calculateMatchCount(item, query),
    snippet: generateSnippet(item.content, query)
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return {
    results: results.slice(0, 10),
    totalResults: results.length
  };
}
```

### Advanced Search Provider Options

**Algolia** (Recommended for scaling):
- Cost: Free tier (10k searches/month), then $1/month for 100k searches
- Features: Typo tolerance, faceting, instant search, highlighting
- Integration: Simple REST API, official Node.js client

**MeiliSearch** (Self-hosted):
- Cost: EC2 t3.micro (self-hosted) ~$8/month OR serverless container ~$2/month
- Features: Typo tolerance, filtering, fast search (<50ms)
- Integration: REST API, Docker container

**OpenSearch** (AWS):
- Cost: Minimum ~$20/month (not cost-effective for small wikis)
- Features: Full Elasticsearch compatibility, advanced analytics
- Not recommended for family wiki due to cost

### Search UI Components

```typescript
// Search dialog component (pseudo-code)
<SearchDialog trigger={<Kbd>Ctrl+K</Kbd>}>
  <SearchInput 
    placeholder="Search wiki..."
    onInput={handleSearch}
    shortcuts={['Ctrl+K', 'Cmd+K']}
  />
  
  <SearchFilters>
    <Toggle label="Titles only" />
    <Dropdown label="Scope" options={['All pages', 'Current folder']} />
  </SearchFilters>
  
  <SearchResults>
    {results.map(result => (
      <SearchResult
        title={result.pageTitle}
        snippet={result.snippet}
        highlights={result.highlightedTerms}
        onClick={() => navigateToPage(result.pageId)}
      />
    ))}
  </SearchResults>
  
  <Pagination 
    currentPage={page}
    totalPages={totalPages}
    onPageChange={setPage}
  />
</SearchDialog>
```

### Search Index Update Flow

```
Page Created/Updated
    ↓
Save to Storage Plugin
    ↓
Emit "pageChanged" Event
    ↓
Search Provider Listener
    ↓
Extract Title, Content, Tags
    ↓
Tokenize Content (split into words)
    ↓
Call searchProvider.indexPage()
    ↓
Update Search Index (DynamoDB/Algolia/etc.)
    ↓
Return Success (async, non-blocking)
```

### Configuration Example

```yaml
# .specifyrc.yml or config file
search:
  provider: "dynamodb" # or "algolia", "meilisearch", "custom"
  
  dynamodb:
    tableName: "WikiSearchIndex"
    region: "us-east-1"
  
  algolia:
    appId: "YOUR_APP_ID"
    apiKey: "YOUR_API_KEY"
    indexName: "wiki_pages"
  
  meilisearch:
    host: "https://meilisearch.example.com"
    apiKey: "YOUR_API_KEY"
  
  options:
    indexDelay: 5000 # ms to wait before indexing (debounce)
    maxQueryLength: 200 # chars
    resultsPerPage: 10
    enableAutoSuggest: true # P3 feature
    storeSearchHistory: true # P3 feature
```
