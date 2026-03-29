---
description: BlueFinWiki vision — what family members should be able to do with their wiki
tags: [bluefinwiki, north-star, vision, declarations]
audience: { human: 60, agent: 40 }
purpose: { north-star: 100 }
---

# BlueFinWiki: What Great Looks Like

> A private, pluggable family wiki where any member can capture, organize, find, and share knowledge — with zero ops burden, near-zero cost, and the freedom to swap any technology underneath.

A family member opens their wiki and sees what's changed since they last visited. They search for a recipe Grandma wrote last month and find it instantly. They create a new page about the family holiday, drag photos into the editor, link it to the trip planning page, and nest it under "Holidays." Another family member reads it, leaves a comment, and restores an older version of a different page that was accidentally overwritten. The admin invites a new family member with one click. Nobody thinks about servers, backups, or AWS bills. The wiki just works. And if the family ever outgrows S3 storage or wants smarter search, the underlying technology swaps out without touching the wiki content or user experience.

---

## Content Creation

- A family member should be able to create a new page with a title and start writing in Markdown immediately
- A family member should be able to see a live preview of their Markdown as they type, side by side with the editor
- A family member should be able to use a formatting toolbar without knowing Markdown syntax
- A family member should be able to attach files to a page by dragging them into the editor
- A family member should be able to insert images inline and see them rendered in the preview
- A family member should be able to control image display size using simple syntax in the editor
- A family member should be able to save their work and know it was saved successfully
- A family member should be able to resume editing a page they were working on without losing content

---

## Organization

- A family member should be able to organize pages into a hierarchy — nesting pages under other pages like folders
- A family member should be able to move a page to a different location in the hierarchy by dragging it
- A family member should be able to rename a page without breaking any links to it
- A family member should be able to see the full path to any page (breadcrumbs) and navigate up the hierarchy
- A family member should be able to view a table of contents generated from the headings on any page
- A family member should be able to browse the entire wiki structure in a sitemap view

---

## Linking & Discovery

- A family member should be able to link to another wiki page by typing its name in double brackets
- A family member should be able to see suggestions as they type a link and select the right page
- A family member should be able to see which other pages link to the page they're reading
- A family member should be able to click a broken link and create the missing page from that link
- A family member should be able to search the entire wiki and find pages by title, content, or tags
- A family member should be able to scope a search to a specific section of the wiki
- A family member should be able to find a page they searched for recently without retyping the query

---

## Versioning & History

- A family member should be able to see every previous version of a page and who edited it
- A family member should be able to compare any two versions of a page and see what changed
- A family member should be able to restore a previous version of a page with one action
- A family member should be able to see who last edited a page and when

---

## Collaboration

- A family member should be able to leave a comment on any page to discuss its content
- A family member should be able to reply to another member's comment in a thread
- A family member should be able to edit or delete their own comments
- A family member should be able to tag pages with categories and keywords to help others find them
- A family member should be able to set a page's status (draft, published, archived) to signal its readiness
- A family member should be able to see recent activity across the wiki from a dashboard

---

## Access & Identity

- A family member should be able to join the wiki only through an invitation from an admin
- A family member should be able to log in with email and password and stay logged in across sessions
- A family member should be able to reset their password if they forget it
- An admin should be able to invite new family members by generating an invitation link
- An admin should be able to see all members, change their roles, and suspend accounts
- An admin should be able to control which features are enabled (comments, exports, etc.)
- Draft pages should be visible only to their author and admins

---

## Portability & Export

- A family member should be able to export any page as a PDF with proper formatting
- A family member should be able to export a section of the wiki as a self-contained HTML bundle
- An export should include all attachments and preserve internal links where possible

---

## Mobile & Accessibility

- A family member should be able to read and navigate the wiki comfortably on a phone
- A family member should be able to edit pages on a phone with a touch-friendly toolbar
- A family member should be able to use the wiki with a screen reader
- The wiki should work at 200% zoom without losing functionality

---

## Onboarding

- A new family member should be able to understand the wiki's features through a guided tour on first login
- A family member should be able to access Markdown help from the editor at any time
- Contextual tooltips should explain unfamiliar controls without requiring a manual

---

## Pluggable Architecture

- It should be possible to swap the storage backend without changing the wiki's features or content
- It should be possible to swap the search provider without changing the user experience
- It should be possible to swap the authentication provider without re-inviting family members
- A new plugin should only need to implement a defined interface — no changes to the rest of the system
- The wiki should not be locked into any single cloud provider or service

---

## Reliability

- The wiki should remain usable when a single AWS service experiences degradation
- A family member should be warned before overwriting someone else's concurrent edit
- The wiki should handle all errors with clear, actionable messages — never a blank screen
- The total monthly cost should stay under $5 for a family of up to 20 members

---

## What Great Looks Like

| Declaration | Why It Matters |
|-------------|----------------|
| Create, organize, and link pages without friction | The wiki becomes the family's go-to place for knowledge |
| Find anything by searching or browsing | Knowledge that can't be found is knowledge that's lost |
| See history, compare versions, restore mistakes | Confidence to edit without fear of permanent damage |
| Invite-only with admin controls | Private family space, not a public wiki |
| Works on phone, works with screen reader | Nobody excluded from the family wiki |
| Zero ops, near-zero cost | Sustainable for a family, not a business expense |
| Swap storage, search, or auth without user impact | No vendor lock-in, technology evolves independently |

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Require Markdown knowledge to contribute | Provide toolbar and live preview |
| Require server maintenance or manual backups | Serverless with automatic versioning |
| Make search an afterthought | Search is the primary discovery mechanism |
| Lock content in a proprietary format | Markdown files in S3, exportable as PDF/HTML |
| Charge more than a streaming subscription | Target <$5/month for the whole family |

---

*Every family member should be able to capture what they know and find what others have shared — without thinking about the technology underneath.*
