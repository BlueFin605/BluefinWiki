# Page Comments Feature Specification

## Overview
Enable users to leave comments on wiki pages, facilitating discussion and collaboration around content without modifying the page itself. Comments support CRUD operations and threaded replies.

## User Stories

### US-10.1: View Comments on a Page (P1)
**As a** wiki user  
**I want to** view all comments on a page  
**So that** I can see discussions and feedback about the page content

**Acceptance Criteria:**
- Comments section appears below the page content
- Comments are displayed in chronological order (oldest first by default)
- Each comment shows:
  - Author name and avatar/initials
  - Timestamp (relative time: "2 hours ago" with full timestamp on hover)
  - Comment text (rendered Markdown)
  - Reply count if the comment has replies
  - Action buttons (Reply, Edit, Delete) when appropriate
- Replies are indented/threaded under parent comments
- Comments are paginated if more than 50 comments exist
- "No comments yet" message displayed when no comments exist
- Comment count badge shown in page header/metadata area

**Technical Notes:**
- Comments stored in DynamoDB with structure:
  - PK: `PAGE#{pageGuid}`, SK: `COMMENT#{timestamp}#{commentGuid}`
  - Attributes: commentGuid, pageGuid, authorId, authorName, text, createdAt, updatedAt, parentCommentGuid (null for top-level), isDeleted
- Real-time updates via WebSocket for collaborative viewing
- Sort options: Chronological, Newest first, Most replies

**Constitutional Alignment:**
- **Simplicity First**: Comments as optional module, non-intrusive to page content
- **User Experience**: Clear visual hierarchy for threaded discussions
- **Accessibility**: WCAG 2.1 AA compliant comment display

---

### US-10.2: Add a Comment to a Page (P1)
**As a** wiki user with Editor or Admin role  
**I want to** add a comment to a page  
**So that** I can ask questions, provide feedback, or start discussions about the content

**Acceptance Criteria:**
- Comment input form appears at bottom of comments section
- Form includes:
  - Multi-line text area with Markdown support
  - Markdown formatting toolbar (bold, italic, links, code, lists)
  - "Preview" tab to see rendered comment
  - Character counter (max 5000 characters)
  - "Add Comment" button
  - "Cancel" button (clears input)
- All authenticated users can add comments
- Comment is posted immediately on "Add Comment" click
- User sees success notification: "Comment added"
- Page auto-scrolls to the new comment
- Comment appears with "Just now" timestamp
- User's avatar/initials shown next to comment
- Input form clears after successful submission
- Validation: Cannot submit empty comment or comment with only whitespace
- Error handling: Display error message if submission fails

**Technical Notes:**
- Markdown renderer same as page content (security: sanitize HTML, no script tags)
- Rate limiting: Max 10 comments per user per hour
- Optimistic UI: Show comment immediately, rollback if save fails
- Generate commentGuid using UUID v4

**Constitutional Alignment:**
- **Simplicity First**: Familiar Markdown interface, no WYSIWYG complexity
- **Pluggable Architecture**: Comments module can be disabled per wiki
- **User Experience**: Immediate feedback, no page reload required

---

### US-10.3: Reply to a Comment (P1)
**As a** wiki user with Editor or Admin role  
**I want to** reply to a specific comment  
**So that** I can respond directly to someone's question or feedback

**Acceptance Criteria:**
- "Reply" button appears on each comment
- Clicking "Reply" shows inline reply form below the parent comment
- Reply form identical to main comment form but:
  - Labeled "Reply to [Author Name]"
  - Slightly indented to show relationship
  - "Cancel" button collapses the form
- Reply appears nested under parent comment when posted
- Maximum nesting depth: 3 levels (prevent excessive threading)
- If max depth reached, "Reply" redirects to parent level with "@mention"
- Reply notifications sent to parent comment author
- Replies have visual connector (line or indentation) to parent

**Technical Notes:**
- Store parentCommentGuid to maintain thread relationship
- Query pattern: GSI on parentCommentGuid for fetching replies
- Replies sorted chronologically within each parent
- Consider collapsing long threads (show "View N more replies")

**Constitutional Alignment:**
- **User Experience**: Clear visual hierarchy for conversations
- **Simplicity First**: Limited nesting prevents confusing thread structures
- **Community**: Facilitates focused discussions

---

### US-10.4: Edit My Own Comment (P2)
**As a** wiki user  
**I want to** edit my own comments  
**So that** I can correct mistakes or clarify my thoughts

**Acceptance Criteria:**
- "Edit" button appears only on user's own comments
- Clicking "Edit" transforms comment into edit form:
  - Pre-filled with existing comment text
  - Same Markdown editor as new comment
  - "Save" and "Cancel" buttons
- "Cancel" reverts to original comment display
- "Save" updates comment and shows success notification
- Comment shows "(edited)" indicator with edit timestamp on hover
- Edit history tracked (timestamp of last edit, not full history for MVP)
- Cannot edit comments older than 24 hours (configurable)
- Admins can edit any comment

**Technical Notes:**
- Update `updatedAt` timestamp on edit
- Store original `createdAt` separately
- Add `editedBy` field for admin edits
- Validation: Same as new comment (not empty, max 5000 chars)

**Constitutional Alignment:**
- **User Experience**: Users can correct mistakes without deletion
- **Transparency**: Edit indicator maintains trust
- **Simplicity First**: No full edit history for MVP

---

### US-10.5: Delete My Own Comment (P2)
**As a** wiki user  
**I want to** delete my own comments  
**So that** I can remove comments I no longer want visible

**Acceptance Criteria:**
- "Delete" button appears only on user's own comments
- Clicking "Delete" shows confirmation modal:
  - "Are you sure you want to delete this comment?"
  - Warning: "This action cannot be undone"
  - "Delete" and "Cancel" buttons
- On confirmation:
  - Comment is soft-deleted (marked as deleted, not removed from DB)
  - Comment text replaced with "[Comment deleted]" in gray italic
  - Author and timestamp remain visible
  - Replies remain visible with parent showing as deleted
- Admins can delete any comment
- Hard delete option available to admins (removes completely)
- Cannot delete comment if it has replies (must delete replies first OR keep as placeholder)

**Technical Notes:**
- Soft delete: Set `isDeleted: true`, clear `text` field
- Hard delete: Only for admins, removes DynamoDB record
- If comment has replies, keep record for thread continuity
- Audit log for deletions (who deleted what and when)

**Constitutional Alignment:**
- **User Control**: Users can remove their own content
- **Data Integrity**: Soft delete preserves thread structure
- **Admin Powers**: Admins can moderate harmful content

---

### US-10.6: Mention Users in Comments (P3)
**As a** wiki user  
**I want to** mention other users in comments using @username  
**So that** I can notify them and draw their attention to specific discussions

**Acceptance Criteria:**
- Typing "@" in comment editor triggers autocomplete dropdown
- Dropdown shows list of wiki users matching typed characters
- Selecting user inserts "@Username" in comment
- Mentioned users highlighted in rendered comment (blue background)
- Mentioned users receive notification (if notifications enabled)
- Clicking mentioned username links to user profile/recent activity
- Can mention multiple users in one comment
- Invalid mentions (non-existent users) render as plain text

**Technical Notes:**
- Parse comment text for @mentions on save
- Store mentioned user IDs in `mentions: [userId1, userId2]` array
- Trigger notification service for each mentioned user
- Autocomplete queries user list from DynamoDB (cache for performance)

**Constitutional Alignment:**
- **Community**: Facilitates direct communication
- **User Experience**: Familiar @ mention pattern
- **Pluggable Architecture**: Works with notification module if enabled

---

### US-10.7: Comment Reactions/Likes (P3)
**As a** wiki user  
**I want to** react to comments with emoji/likes  
**So that** I can show agreement or appreciation without adding a comment

**Acceptance Criteria:**
- Each comment has reaction buttons below text:
  - 👍 (Like), ❤️ (Love), 😄 (Laugh), 🤔 (Thinking), 👎 (Dislike)
- Clicking reaction adds/removes user's reaction
- Reaction count shown next to each emoji
- Hovering over count shows tooltip with users who reacted
- User's own reactions highlighted (filled vs outline)
- Reactions saved immediately (optimistic UI)
- Reactions visible to all users
- No reaction limit per user per comment

**Technical Notes:**
- Store reactions in separate DynamoDB item or within comment item:
  - `reactions: { like: [userId1, userId2], love: [userId3] }`
- Count reactions for display
- Consider Lambda for reaction processing if high volume

**Constitutional Alignment:**
- **User Experience**: Low-friction feedback mechanism
- **Simplicity First**: Limited emoji set prevents clutter
- **Community**: Encourages positive engagement

---

### US-10.8: Sort and Filter Comments (P3)
**As a** wiki user  
**I want to** sort and filter comments  
**So that** I can find relevant discussions more easily

**Acceptance Criteria:**
- Sort dropdown above comments section with options:
  - Oldest first (default)
  - Newest first
  - Most replies
  - Most reactions (if reactions implemented)
- Filter options:
  - Show all comments
  - Show only my comments
  - Show unresolved (if resolution feature added)
- Sort/filter selections persist during session
- Comment count updates based on active filters
- "Clear filters" button appears when filters active

**Technical Notes:**
- Client-side sorting for small comment sets (<100)
- Server-side sorting for large comment sets
- DynamoDB GSI on pageGuid + timestamp for sorting
- Store sort preference in sessionStorage

**Constitutional Alignment:**
- **User Experience**: Users find information efficiently
- **Scalability**: Handles wikis with active discussions
- **Simplicity First**: Basic sort options, not over-engineered

---

### US-10.9: Resolve/Close Comment Threads (P3)
**As a** page author or admin  
**I want to** mark comment threads as resolved  
**So that** I can indicate questions have been answered or issues addressed

**Acceptance Criteria:**
- "Mark as Resolved" button on top-level comments (author/admin only)
- Resolved comments show green checkmark icon
- Resolved comments collapsed by default with "View resolved" toggle
- Can unresolve comments if needed
- Filter: "Show resolved" / "Hide resolved"
- Resolved count shown separately: "5 comments, 2 resolved"

**Technical Notes:**
- Add `isResolved: boolean` field to comment record
- Add `resolvedAt: timestamp` and `resolvedBy: userId`
- Include resolved comments in search/export

**Constitutional Alignment:**
- **User Experience**: Reduces clutter from addressed discussions
- **Transparency**: Resolved status visible to all
- **Admin Powers**: Page owners can manage their discussions

---

## Technical Architecture

### Data Model (DynamoDB)

```typescript
interface Comment {
  commentGuid: string;           // UUID v4
  pageGuid: string;              // Associated page
  authorId: string;              // User ID
  authorName: string;            // Cached for display
  text: string;                  // Markdown content
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  parentCommentGuid?: string;    // null for top-level
  isDeleted: boolean;            // Soft delete flag
  isResolved: boolean;           // P3 feature
  mentions: string[];            // User IDs mentioned
  reactions?: {                  // P3 feature
    like: string[];              // User IDs
    love: string[];
    laugh: string[];
    thinking: string[];
    dislike: string[];
  };
}

// DynamoDB Schema
PK: PAGE#{pageGuid}
SK: COMMENT#{timestamp}#{commentGuid}

// GSI for user's comments
GSI1PK: USER#{userId}
GSI1SK: COMMENT#{timestamp}

// GSI for replies
GSI2PK: PARENT#{parentCommentGuid}
GSI2SK: COMMENT#{timestamp}
```

### API Endpoints

```
POST   /api/pages/{pageGuid}/comments              - Create comment
GET    /api/pages/{pageGuid}/comments              - List comments
GET    /api/pages/{pageGuid}/comments/{commentId}  - Get single comment
PUT    /api/pages/{pageGuid}/comments/{commentId}  - Update comment
DELETE /api/pages/{pageGuid}/comments/{commentId}  - Delete comment
POST   /api/comments/{commentId}/reactions         - Add reaction
DELETE /api/comments/{commentId}/reactions/{type}  - Remove reaction
PUT    /api/comments/{commentId}/resolve           - Mark resolved
```

### Security Considerations

- **Authentication**: All comment operations require authenticated user
- **Authorization**:
  - Standard users: CRUD on own comments, read all
  - Admins: Full CRUD on all comments
- **Input Validation**:
  - Sanitize Markdown to prevent XSS
  - Validate comment length (max 5000 chars)
  - Rate limiting to prevent spam
- **Soft Delete**: Preserve data for audit trail
- **Encryption**: Comments encrypted at rest in DynamoDB

### Performance Considerations

- **Pagination**: Load 50 comments initially, lazy load on scroll
- **Caching**: Cache comment counts in page metadata
- **Real-time**: WebSocket updates for live collaboration
- **Indexing**: GSI for efficient queries by page, user, parent
- **Optimistic UI**: Show changes immediately, rollback on error

---

## UI/UX Specifications

### Visual Design
- Comments section separated from page content by horizontal rule
- Each comment in card-style container with subtle border
- Replies indented 40px with vertical connector line
- User avatars 32x32px (replies 28x28px)
- Timestamp in gray, smaller font
- Action buttons appear on hover (always visible on mobile)

### Mobile Considerations
- Stack avatar and metadata vertically on narrow screens
- Full-width comment cards
- Swipe actions for edit/delete
- Simplified reply UI (modal instead of inline)
- Larger tap targets for buttons (44x44px minimum)

### Accessibility (WCAG 2.1 AA)
- Semantic HTML: `<article>` for comments, `<button>` for actions
- ARIA labels: "Reply to comment by [author]"
- Keyboard navigation: Tab through comments, Enter to activate
- Focus indicators on all interactive elements
- Screen reader announcements for comment actions
- Color contrast ratio ≥4.5:1 for text
- Skip link: "Skip to comments" from page content

### Loading States
- Skeleton loaders for initial comment load
- Spinner for pagination/infinite scroll
- Inline spinner for post/update actions
- Error states with retry option

---

## Module Configuration

As per BlueFinWiki Constitution's pluggable architecture:

```yaml
# wiki-config.yml
modules:
  comments:
    enabled: true
    settings:
      maxCommentLength: 5000
      maxNestingDepth: 3
      editWindowHours: 24
      rateLimit: 10  # comments per hour per user
      reactions:
        enabled: true  # P3 feature
        types: [like, love, laugh, thinking, dislike]
      mentions:
        enabled: true  # P3 feature
      resolution:
        enabled: true  # P3 feature
```

---

## Testing Requirements

### Unit Tests
- Comment CRUD operations
- Markdown rendering and sanitization
- Permission checks (role-based)
- Nesting depth validation
- Rate limiting logic

### Integration Tests
- Comment lifecycle (create → edit → delete)
- Reply threading
- Real-time updates via WebSocket
- Mention notifications
- Reaction updates

### E2E Tests
- User creates comment and sees it displayed
- User replies to comment and sees threaded view
- User edits own comment and sees "(edited)" indicator
- User deletes comment and sees "[Comment deleted]"
- Admin deletes other user's comment
- Standard user can create and edit their own comments

### Accessibility Tests
- Keyboard navigation through comments
- Screen reader announces comment actions
- Color contrast verification
- Focus management after actions

---

## Dependencies

- **AWS Services**:
  - DynamoDB: Comment storage
  - Lambda: API endpoints
  - API Gateway: RESTful API
  - WebSocket API: Real-time updates
  - CloudWatch: Logging and monitoring

- **Frontend**:
  - Markdown renderer (same as page content)
  - WebSocket client for real-time
  - Date formatting library (date-fns)
  - Optimistic UI state management

- **Modules**:
  - User Management (authentication, roles)
  - Notification System (for mentions, P3)
  - Search (index comments for search, P3)

---

## Migration Plan

### Phase 1: Core Comments (P1)
- US-10.1: View comments
- US-10.2: Add comment
- US-10.3: Reply to comment

### Phase 2: Management (P2)
- US-10.4: Edit comment
- US-10.5: Delete comment

### Phase 3: Enhanced Features (P3)
- US-10.6: Mentions
- US-10.7: Reactions
- US-10.8: Sort/filter
- US-10.9: Resolve threads

---

## Open Questions

1. **Comment Notifications**: Should comment creation trigger email notifications? (Depends on notification module)
2. **Export**: Should comments be included in PDF/HTML exports? (Recommend: yes, as appendix)
3. **Search**: Should comment content be searchable? (Recommend: yes, but lower priority than page content)
4. **Anonymous Comments**: Allow guest comments with moderation? (Recommend: no, invite-only wiki)
5. **Comment Templates**: Pre-formatted comment types (question, suggestion, issue)? (Recommend: post-MVP)
6. **Attachments in Comments**: Allow image/file attachments? (Recommend: links only for MVP)

---

## Success Metrics

- **Engagement**: Average comments per page
- **Response Time**: Time from comment posted to first reply
- **Moderation**: Deleted comments as % of total
- **Performance**: Comment load time <500ms
- **Accessibility**: Zero WCAG 2.1 AA violations
- **User Satisfaction**: Survey feedback on comment feature

---

## Constitutional Alignment Summary

This specification aligns with BlueFinWiki Constitution principles:

1. ✅ **Simplicity First**: Markdown-based, familiar interface, no complex threading
2. ✅ **User Experience**: Clear visual hierarchy, immediate feedback, responsive design
3. ✅ **Pluggable Architecture**: Comments as optional module with configuration
4. ✅ **Accessibility**: WCAG 2.1 AA compliant throughout
5. ✅ **Scalability**: DynamoDB design supports growth, pagination for performance
6. ✅ **Security**: Role-based permissions, input sanitization, rate limiting
7. ✅ **Admin Powers**: Admins can moderate all comments
8. ✅ **User Control**: Users manage their own comments
9. ✅ **Transparency**: Edit indicators, soft delete preserves context

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-12  
**Status**: Draft - Ready for Review
