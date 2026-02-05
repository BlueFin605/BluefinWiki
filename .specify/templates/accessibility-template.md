# Accessibility Requirements Template (WCAG 2.1 AA)

Use this template to add accessibility requirements to each specification.

---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- All interactive elements are keyboard-accessible (Tab, Enter, Escape, Arrow keys)
- Focus order follows logical reading order
- Focus indicators clearly visible (2px outline, high contrast)
- Keyboard shortcuts documented and don't conflict with screen readers
- Skip navigation links for lengthy pages
- No keyboard traps

### Screen Reader Support
- Semantic HTML elements used (`<button>`, `<nav>`, `<main>`, `<article>`)
- ARIA labels and roles where needed (`role="dialog"`, `aria-label`, `aria-describedby`)
- Form inputs have associated `<label>` elements
- Error messages announced to screen readers
- Loading/busy states announced (`aria-busy`, `aria-live`)
- Dynamic content changes announced

### Visual Design
- **Color Contrast**: Text meets 4.5:1 ratio (7:1 for AAA)
- **Focus Indicators**: Visible and high contrast (minimum 3:1 against background)
- **Color Independence**: Information not conveyed by color alone
- **Text Sizing**: Supports zoom up to 200% without loss of functionality
- **Touch Targets**: Minimum 44x44 pixels (mobile)
- **Line Height**: Minimum 1.5x font size for body text

### Content & Structure
- Page titles are descriptive and unique
- Headings follow hierarchical structure (H1 → H2 → H3)
- Link text is descriptive (avoid "click here")
- Alt text provided for all images
- Tables have proper headers (`<th>`)
- Forms have clear labels and error messages

### Interactive Elements
- Buttons clearly indicate their action
- Disabled states are visually clear and announced
- Loading states provide feedback
- Modals/dialogs trap focus and return focus on close
- Tooltips accessible via keyboard (focus/blur)

### Error Handling
- Error messages are clear and actionable
- Form validation provides specific guidance
- Errors associated with fields programmatically
- Success confirmations announced

### Testing Checklist
- [ ] Keyboard-only navigation works for all features
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Color contrast verification (WAVE, axe DevTools)
- [ ] Zoom to 200% without horizontal scroll
- [ ] Touch target size verification (mobile)
- [ ] Automated accessibility scan (axe, Lighthouse)

---

## Mobile Accessibility Considerations
- Touch targets meet size requirements
- Swipe gestures have alternatives
- Orientation changes supported
- Content reflows properly on small screens
- Text remains readable without zooming

---

## Implementation Notes
- Use accessible UI component library when possible
- Include accessibility in code review checklist
- Test with actual assistive technology users
- Document keyboard shortcuts in help system
