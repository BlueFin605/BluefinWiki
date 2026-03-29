# MVP Simplifications (March 2026)

This document tracks features that were simplified or deferred from MVP to accelerate delivery. All deferred features are planned for post-MVP implementation.

---

## 🎯 Rationale

To deliver a working MVP faster, we've temporarily removed non-essential features that add complexity without being critical to core wiki functionality. These features will be re-implemented after MVP launch based on user feedback.

---

## 📝 Deferred Features

### 1. Editor Autosave → Manual Save Only

**Status**: REMOVED FROM MVP  
**Date**: March 7, 2026

#### What Was Removed
- Automatic save with 5-second debounce
- "Saving..." indicators with timestamps
- Browser navigation warnings for unsaved changes
- Optimistic updates and conflict resolution dialogs
- `useAutosave` hook and `useUnsavedChanges` hook

#### Current Implementation
- **Manual save button** with keyboard shortcut (Ctrl+S)
- **Simple change indicator** showing three states:
  - ✓ All changes saved (green)
  - ● Unsaved changes (yellow)
  - Saving... (blue)
- **WARNING**: Navigating to different page discards all unsaved changes

#### Impact
- Users must manually click Save button
- Risk of data loss if user navigates away without saving
- Simpler codebase, fewer edge cases to handle

#### Post-MVP Implementation Plan
1. Re-implement autosave with debouncing:
   - Debounce: 5 seconds after last edit
   - Visual feedback: "Saving..." → "Saved at HH:MM"
   - Error handling: Retry with exponential backoff
2. Add browser navigation warnings:
   - Use `beforeunload` event to warn users
   - Offer "Save and Continue" or "Discard Changes" options
3. Consider localStorage backup:
   - Auto-save drafts to localStorage every 30 seconds
   - Recover unsaved content on browser crash/refresh
   - Clear localStorage after successful save

#### Files Modified
- ✅ Deleted: `frontend/src/hooks/useAutosave.ts`
- ✅ Deleted: `frontend/src/hooks/useUnsavedChanges.ts`
- ✅ Deleted: `frontend/src/hooks/__tests__/useAutosave.test.ts`
- ✅ Deleted: `frontend/src/hooks/__tests__/useUnsavedChanges.test.ts`
- ✅ Updated: `frontend/src/hooks/index.ts`
- ✅ Simplified: `frontend/src/components/editor/EditorPane.tsx`
- ✅ Simplified: `frontend/src/components/pages/PageEditor.tsx`
- ✅ Updated: `frontend/src/components/editor/__tests__/EditorPane.test.tsx`

---

### 2. Frontend Caching → No Client Caching

**Status**: REMOVED FROM MVP  
**Date**: March 7, 2026

#### What Was Removed
- React Query caching of API responses
- Search results caching (5-minute TTL)
- Page hierarchy caching
- PDF render caching (1-hour TTL)
- Optimistic updates on page edits

#### Current Implementation
- **Fresh API calls** on every request
- **No client-side cache** - data fetched directly from backend
- **React Query** still used for data fetching, but with `cacheTime: 0` effectively

#### Impact
- More API calls to backend (acceptable for 3-20 concurrent users)
- Slightly higher latency on repeat requests
- Simpler state management, no cache invalidation complexity
- S3 sub-10ms latency makes this acceptable for MVP

#### Post-MVP Implementation Plan
1. **Implement React Query caching** with appropriate TTLs:
   ```typescript
   // Page content caching
   const { data } = useQuery({
     queryKey: ['page', pageGuid],
     queryFn: () => fetchPage(pageGuid),
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 15 * 60 * 1000, // 15 minutes
   });
   
   // Search results caching
   const { data } = useQuery({
     queryKey: ['search', query],
     queryFn: () => searchPages(query),
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
   
   // Page hierarchy caching
   const { data } = useQuery({
     queryKey: ['pageTree'],
     queryFn: fetchPageTree,
     staleTime: 10 * 60 * 1000, // 10 minutes
   });
   ```

2. **Cache invalidation strategies**:
   - Invalidate page cache on edit: `queryClient.invalidateQueries(['page', pageGuid])`
   - Invalidate tree cache on page create/move/delete: `queryClient.invalidateQueries(['pageTree'])`
   - Invalidate search cache on any page edit: `queryClient.invalidateQueries(['search'])`

3. **CloudFront API caching**:
   - Cache GET requests with appropriate headers
   - Invalidate on page edits (requires invalidation API calls)
   - Consider versioned URLs for cache busting

4. **PDF render caching**:
   - Cache generated PDFs in S3 with 1-hour expiry
   - Invalidate on page content changes
   - Use ETag for cache validation

#### Files Modified
- ✅ Updated: `TECHNICAL-PLAN.md` (updated caching strategy section)
- ✅ Updated: `TASKS.md` (marked caching tasks as deferred)

---

## 🎯 Benefits of Simplification

### Development Velocity
- **Faster delivery**: Removed ~2000 lines of autosave/caching code and tests
- **Fewer bugs**: Eliminated complex race conditions and edge cases
- **Easier testing**: Manual save is straightforward to test

### Simpler Architecture
- **Reduced complexity**: No cache invalidation logic or stale data handling
- **Clearer flow**: User action → API call → Update UI (no intermediate caching layer)
- **Easier debugging**: Fewer moving parts, clearer data flow

### User Experience Tradeoff
- **Acceptable for MVP**: Family wiki with 3-20 users can tolerate manual save
- **Get user feedback**: Learn if autosave is actually needed before implementing
- **Iterate based on usage**: Add features users actually want, not assumed needs

---

## 📊 Performance Considerations

### Current MVP Performance
- **S3 latency**: Sub-10ms for page retrieval
- **Lambda cold start**: 200-500ms (acceptable for low-traffic wikis)
- **API round-trip**: ~100-300ms for typical requests
- **Frontend build**: 5.88s production build time

### Expected Impact Without Caching
- **Page load**: ~300-500ms (fresh API call every time)
- **Search**: ~200-400ms per query (no result caching)
- **Navigation**: ~300-500ms between pages (no prefetch/cache)

**Verdict**: Acceptable for 3-20 concurrent users. Post-MVP caching will improve this to <100ms for cached requests.

---

## 📅 Post-MVP Roadmap

### Phase 1: Autosave (High Priority)
**Target**: 1-2 weeks post-MVP  
**Scope**:
- [ ] Implement `useAutosave` hook with debouncing
- [ ] Add "Saving..." and "Saved at HH:MM" indicators
- [ ] Browser navigation warnings
- [ ] Error handling and retry logic
- [ ] Unit tests and integration tests

**Success Criteria**:
- Users never lose work due to navigation/browser crash
- Save indicators provide clear feedback
- Less than 3% save failure rate (with retry)

---

### Phase 2: Frontend Caching (Medium Priority)
**Target**: 2-4 weeks post-MVP  
**Scope**:
- [ ] React Query caching for all data fetches
- [ ] Cache invalidation on CRUD operations
- [ ] Optimistic updates for page edits
- [ ] Performance monitoring and cache hit rates

**Success Metrics**:
- 80%+ cache hit rate for page views
- <100ms response time for cached requests
- 50% reduction in API calls

---

### Phase 3: Advanced Caching (Low Priority)
**Target**: 1-2 months post-MVP (based on usage patterns)  
**Scope**:
- [ ] CloudFront API response caching
- [ ] PDF render caching
- [ ] Prefetch frequently accessed pages
- [ ] Service worker for offline support (optional)

**Success Metrics**:
- 90%+ cache hit rate across all requests
- Support for 50+ concurrent users
- Graceful offline degradation

---

## 🔗 Related Documents

- [TECHNICAL-PLAN.md](TECHNICAL-PLAN.md) - Updated caching strategy
- [TASKS.md](TASKS.md) - Updated task list with deferred items
- [gaps.md](gaps.md) - Updated post-MVP feature list
- [AUTOSAVE-FIX.md](AUTOSAVE-FIX.md) - Previous autosave implementation (now removed)
- [AUTOSAVE-VISIBILITY-FIX.md](AUTOSAVE-VISIBILITY-FIX.md) - Previous autosave visibility fix (now removed)

---

## 📝 Change Log

### March 7, 2026
- **Removed autosave** from MVP (hook deleted, manual save only)
- **Removed frontend caching** from MVP (React Query caching disabled)
- Updated documentation to reflect simplified architecture
- Built and tested frontend successfully without these features
