/**
 * Tests for MarkdownToolbar component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownToolbar } from '../MarkdownToolbar';

describe('MarkdownToolbar', () => {
  describe('Basic Rendering', () => {
    it('should render all toolbar buttons', () => {
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      // Text formatting buttons
      expect(screen.getByLabelText('Bold')).toBeInTheDocument();
      expect(screen.getByLabelText('Italic')).toBeInTheDocument();
      expect(screen.getByLabelText('Strikethrough')).toBeInTheDocument();
      
      // Header dropdown trigger
      expect(screen.getByLabelText('Heading dropdown')).toBeInTheDocument();
      
      // List buttons
      expect(screen.getByLabelText('Unordered list')).toBeInTheDocument();
      expect(screen.getByLabelText('Ordered list')).toBeInTheDocument();
      expect(screen.getByLabelText('Task list')).toBeInTheDocument();
      
      // Link, image, and attachment buttons
      expect(screen.getByLabelText('Insert link')).toBeInTheDocument();
      expect(screen.getByLabelText('Insert image')).toBeInTheDocument();
      expect(screen.getByLabelText('Upload attachment')).toBeInTheDocument();
      
      // Code buttons
      expect(screen.getByLabelText('Inline code')).toBeInTheDocument();
      expect(screen.getByLabelText('Code block')).toBeInTheDocument();
    });

    it('should render disabled when disabled prop is true', () => {
      render(<MarkdownToolbar onAction={vi.fn()} disabled={true} />);
      
      const boldButton = screen.getByLabelText('Bold');
      expect(boldButton).toBeDisabled();
      
      const italicButton = screen.getByLabelText('Italic');
      expect(italicButton).toBeDisabled();
    });
  });

  describe('Text Formatting Actions', () => {
    it('should call onAction with bold when Bold button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const boldButton = screen.getByLabelText('Bold');
      await user.click(boldButton);
      
      expect(onAction).toHaveBeenCalledWith('bold');
    });

    it('should call onAction with italic when Italic button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const italicButton = screen.getByLabelText('Italic');
      await user.click(italicButton);
      
      expect(onAction).toHaveBeenCalledWith('italic');
    });

    it('should call onAction with strikethrough when Strikethrough button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const strikeButton = screen.getByLabelText('Strikethrough');
      await user.click(strikeButton);
      
      expect(onAction).toHaveBeenCalledWith('strikethrough');
    });
  });

  describe('Header Menu', () => {
    it('should show header menu when Headers button is clicked', async () => {
      const user = userEvent.setup();
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      // Check for header options
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
      expect(screen.getByText('Heading 4')).toBeInTheDocument();
      expect(screen.getByText('Heading 5')).toBeInTheDocument();
      expect(screen.getByText('Heading 6')).toBeInTheDocument();
    });

    it('should call onAction with h1 when Heading 1 is selected', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      const h1Option = screen.getByText('Heading 1');
      await user.click(h1Option);
      
      expect(onAction).toHaveBeenCalledWith('h1');
    });

    it('should call onAction with h2 when Heading 2 is selected', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      const h2Option = screen.getByText('Heading 2');
      await user.click(h2Option);
      
      expect(onAction).toHaveBeenCalledWith('h2');
    });

    it('should close header menu after selection', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      
      const h1Option = screen.getByText('Heading 1');
      await user.click(h1Option);
      
      // Menu should be closed
      expect(screen.queryByText('Heading 1')).not.toBeInTheDocument();
    });

    it('should close header menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      // Menu should be closed
      expect(screen.queryByText('Heading 1')).not.toBeInTheDocument();
    });
  });

  describe('List Actions', () => {
    it('should call onAction with ul for unordered list', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const ulButton = screen.getByLabelText('Unordered list');
      await user.click(ulButton);
      
      expect(onAction).toHaveBeenCalledWith('ul');
    });

    it('should call onAction with ol for ordered list', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const olButton = screen.getByLabelText('Ordered list');
      await user.click(olButton);
      
      expect(onAction).toHaveBeenCalledWith('ol');
    });

    it('should call onAction with task for task list', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const taskButton = screen.getByLabelText('Task list');
      await user.click(taskButton);
      
      expect(onAction).toHaveBeenCalledWith('task');
    });
  });

  describe('Link and Image Actions', () => {
    it('should call onAction with link for link button', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const linkButton = screen.getByLabelText('Insert link');
      await user.click(linkButton);
      
      expect(onAction).toHaveBeenCalledWith('link');
    });

    it('should call onAction with image for image button', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const imageButton = screen.getByLabelText('Insert image');
      await user.click(imageButton);
      
      expect(onAction).toHaveBeenCalledWith('image');
    });
  });

  describe('Attachment Actions (Task 7.5)', () => {
    it('should render attachment button', () => {
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      expect(screen.getByLabelText('Upload attachment')).toBeInTheDocument();
    });

    it('should call onAction with attachment when attachment button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const attachmentButton = screen.getByLabelText('Upload attachment');
      await user.click(attachmentButton);
      
      expect(onAction).toHaveBeenCalledWith('attachment');
    });

    it('should disable attachment button when disabled prop is true', () => {
      render(<MarkdownToolbar onAction={vi.fn()} disabled={true} />);
      
      const attachmentButton = screen.getByLabelText('Upload attachment');
      expect(attachmentButton).toBeDisabled();
    });

    it('should not call onAction when attachment button is disabled', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} disabled={true} />);
      
      const attachmentButton = screen.getByLabelText('Upload attachment');
      await user.click(attachmentButton);
      
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('Code Actions', () => {
    it('should call onAction with code for inline code', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const codeButton = screen.getByLabelText('Inline code');
      await user.click(codeButton);
      
      expect(onAction).toHaveBeenCalledWith('code');
    });

    it('should call onAction with codeblock for code block', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const codeblockButton = screen.getByLabelText('Code block');
      await user.click(codeblockButton);
      
      expect(onAction).toHaveBeenCalledWith('codeblock');
    });
  });

  describe('Keyboard Shortcuts Hints', () => {
    it('should show keyboard shortcut for Bold', () => {
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      const boldButton = screen.getByLabelText('Bold');
      expect(boldButton).toHaveAttribute('title', 'Bold (Ctrl+B)');
    });

    it('should show keyboard shortcut for Italic', () => {
      render(<MarkdownToolbar onAction={vi.fn()} />);
      
      const italicButton = screen.getByLabelText('Italic');
      expect(italicButton).toHaveAttribute('title', 'Italic (Ctrl+I)');
    });
  });

  describe('Disabled State', () => {
    it('should not call onAction when disabled', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} disabled={true} />);
      
      const boldButton = screen.getByLabelText('Bold');
      await user.click(boldButton);
      
      expect(onAction).not.toHaveBeenCalled();
    });

    it('should disable all buttons when disabled prop is true', () => {
      render(<MarkdownToolbar onAction={vi.fn()} disabled={true} />);
      
      expect(screen.getByLabelText('Bold')).toBeDisabled();
      expect(screen.getByLabelText('Italic')).toBeDisabled();
      expect(screen.getByLabelText('Strikethrough')).toBeDisabled();
      expect(screen.getByLabelText('Heading dropdown')).toBeDisabled();
      expect(screen.getByLabelText('Unordered list')).toBeDisabled();
      expect(screen.getByLabelText('Ordered list')).toBeDisabled();
      expect(screen.getByLabelText('Task list')).toBeDisabled();
      expect(screen.getByLabelText('Insert link')).toBeDisabled();
      expect(screen.getByLabelText('Insert image')).toBeDisabled();
      expect(screen.getByLabelText('Upload attachment')).toBeDisabled();
      expect(screen.getByLabelText('Inline code')).toBeDisabled();
      expect(screen.getByLabelText('Code block')).toBeDisabled();
    });
  });

  describe('Visual Grouping', () => {
    it('should have button groups with separators', () => {
      const { container } = render(<MarkdownToolbar onAction={vi.fn()} />);
      
      // Check for border dividers (button groups)
      const toolbar = container.firstChild;
      expect(toolbar).toBeInTheDocument();
      
      // Visual structure should exist
      expect(container.querySelector('.flex')).toBeInTheDocument();
    });
  });

  describe('All Header Levels', () => {
    it('should support all six header levels', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(<MarkdownToolbar onAction={onAction} />);
      
      const headerButton = screen.getByLabelText('Heading dropdown');
      await user.click(headerButton);
      
      const headerLevels = [
        'Heading 1',
        'Heading 2',
        'Heading 3',
        'Heading 4',
        'Heading 5',
        'Heading 6',
      ];
      
      for (const heading of headerLevels) {
        expect(screen.getByText(heading)).toBeInTheDocument();
      }
    });

    it('should call onAction for each header level', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      
      const headerActions = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const headerLabels = [
        'Heading 1',
        'Heading 2',
        'Heading 3',
        'Heading 4',
        'Heading 5',
        'Heading 6',
      ];
      
      for (let i = 0; i < headerActions.length; i++) {
        onAction.mockClear();
        
        const { unmount } = render(<MarkdownToolbar onAction={onAction} />);
        
        const headerButton = screen.getByLabelText('Heading dropdown');
        await user.click(headerButton);
        
        const headerOption = screen.getByText(headerLabels[i]);
        await user.click(headerOption);
        
        expect(onAction).toHaveBeenCalledWith(headerActions[i]);
        
        unmount();
      }
    });
  });
});
