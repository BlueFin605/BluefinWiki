import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PagePropertiesPanel, PageMetadata } from '../PagePropertiesPanel';

const mockMetadata: PageMetadata = {
  title: 'Test Page',
  tags: ['test', 'example'],
  status: 'published',
  createdBy: 'user-123',
  modifiedBy: 'user-456',
  createdAt: '2026-02-01T10:00:00Z',
  modifiedAt: '2026-02-14T14:00:00Z',
};

describe('PagePropertiesPanel', () => {
  describe('Title Editing', () => {
    it('should display the title', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('should enter edit mode when title is clicked', async () => {
      const user = userEvent.setup();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      await user.click(titleDiv);

      const input = screen.getByRole('textbox', { name: /title/i });
      expect(input).toHaveValue('Test Page');
      expect(input).toHaveFocus();
    });

    it('should save title on Enter key', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      await user.click(titleDiv);

      const input = screen.getByRole('textbox', { name: /title/i });
      await user.clear(input);
      await user.type(input, 'New Title');
      await user.keyboard('{Enter}');

      expect(onMetadataChange).toHaveBeenCalledWith({ title: 'New Title' });
    });

    it('should cancel title edit on Escape key', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      await user.click(titleDiv);

      const input = screen.getByRole('textbox', { name: /title/i });
      await user.clear(input);
      await user.type(input, 'New Title');
      await user.keyboard('{Escape}');

      // Title should revert to original after Escape
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('should not allow empty title', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      await user.click(titleDiv);

      const input = screen.getByRole('textbox', { name: /title/i });
      await user.clear(input);
      await user.keyboard('{Enter}');

      // Title should reset to original when emptied
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });
  });

  describe('Tag Management', () => {
    it('should display existing tags', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('example')).toBeInTheDocument();
    });

    it('should add tag on Enter key', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const input = screen.getByPlaceholderText(/add tags/i);
      await user.type(input, 'newtag{Enter}');

      expect(onMetadataChange).toHaveBeenCalledWith({
        tags: ['test', 'example', 'newtag'],
      });
    });

    it('should add tag on comma', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const input = screen.getByPlaceholderText(/add tags/i);
      await user.type(input, 'newtag,');

      expect(onMetadataChange).toHaveBeenCalledWith({
        tags: ['test', 'example', 'newtag'],
      });
    });

    it('should prevent duplicate tags', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const input = screen.getByPlaceholderText(/add tags/i);
      await user.type(input, 'test{Enter}');

      expect(onMetadataChange).not.toHaveBeenCalled();
    });

    it('should normalize tag to lowercase', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const input = screen.getByPlaceholderText(/add tags/i);
      await user.type(input, 'NewTag{Enter}');

      expect(onMetadataChange).toHaveBeenCalledWith({
        tags: ['test', 'example', 'newtag'],
      });
    });

    it('should remove tag when × button clicked', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const removeButton = screen.getAllByRole('button', { name: /remove tag/i })[0];
      await user.click(removeButton);

      expect(onMetadataChange).toHaveBeenCalledWith({
        tags: ['example'],
      });
    });

    it('should remove last tag on backspace when input is empty', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const input = screen.getByPlaceholderText(/add tags/i);
      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(onMetadataChange).toHaveBeenCalledWith({
        tags: ['test'],
      });
    });
  });

  describe('Status Management', () => {
    it('should display current status', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      const select = screen.getByRole('combobox', { name: /status/i });
      expect(select).toHaveValue('published');
    });

    it('should change status when dropdown changes', async () => {
      const user = userEvent.setup();
      const onMetadataChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={onMetadataChange}
        />
      );

      const select = screen.getByRole('combobox', { name: /status/i });
      await user.selectOptions(select, 'draft');

      expect(onMetadataChange).toHaveBeenCalledWith({ status: 'draft' });
    });

    it('should show draft message for draft status', () => {
      const draftMetadata = { ...mockMetadata, status: 'draft' as const };
      render(
        <PagePropertiesPanel
          metadata={draftMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(/only you and admins can see this page/i)
      ).toBeInTheDocument();
    });

    it('should show archived message for archived status', () => {
      const archivedMetadata = { ...mockMetadata, status: 'archived' as const };
      render(
        <PagePropertiesPanel
          metadata={archivedMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(/read-only, excluded from main navigation/i)
      ).toBeInTheDocument();
    });
  });

  describe('Read-only Display', () => {
    it('should display author information', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText(/created by: user-123/i)).toBeInTheDocument();
      expect(screen.getByText(/modified by: user-456/i)).toBeInTheDocument();
    });

    it('should display formatted timestamps', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText(/created:/i)).toBeInTheDocument();
      expect(screen.getByText(/modified:/i)).toBeInTheDocument();
    });
  });

  describe('Editable Mode', () => {
    it('should not allow editing when editable is false', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
          editable={false}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      fireEvent.click(titleDiv);

      // Should not enter edit mode
      expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument();
    });

    it('should not show tag input when editable is false', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
          editable={false}
        />
      );

      expect(
        screen.queryByPlaceholderText(/add tags/i)
      ).not.toBeInTheDocument();
    });

    it('should not show remove tag buttons when editable is false', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
          editable={false}
        />
      );

      expect(
        screen.queryByRole('button', { name: /remove tag/i })
      ).not.toBeInTheDocument();
    });

    it('should show status as badge when editable is false', () => {
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
          editable={false}
        />
      );

      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: /status/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('should call onTitleChange when title changes', async () => {
      const user = userEvent.setup();
      const onTitleChange = vi.fn();
      render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
          onTitleChange={onTitleChange}
        />
      );

      const titleDiv = screen.getByText('Test Page');
      await user.click(titleDiv);

      const input = screen.getByRole('textbox', { name: /title/i });
      await user.clear(input);
      await user.type(input, 'New Title');
      await user.keyboard('{Enter}');

      expect(onTitleChange).toHaveBeenCalledWith('New Title');
    });
  });

  describe('State Synchronization', () => {
    it('should update local state when metadata prop changes', () => {
      const { rerender } = render(
        <PagePropertiesPanel
          metadata={mockMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();

      const newMetadata = { ...mockMetadata, title: 'Updated Title' };
      rerender(
        <PagePropertiesPanel
          metadata={newMetadata}
          onMetadataChange={vi.fn()}
        />
      );

      expect(screen.getByText('Updated Title')).toBeInTheDocument();
    });
  });
});
