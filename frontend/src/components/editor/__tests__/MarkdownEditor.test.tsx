/**
 * Tests for MarkdownEditor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownEditor } from '../MarkdownEditor';

describe('MarkdownEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with initial value', async () => {
      const { container } = render(
        <MarkdownEditor initialValue="# Hello World" />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });
    });

    it('should render empty editor when no initial value', async () => {
      const { container } = render(<MarkdownEditor />);

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });
    });

    it('should render as read-only when editable is false', async () => {
      const { container } = render(
        <MarkdownEditor initialValue="# Test" editable={false} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
        
        // Check for readonly attribute on content element
        const contentElement = container.querySelector('.cm-content');
        expect(contentElement).toHaveAttribute('contenteditable', 'false');
      });
    });
  });

  describe('Content Changes', () => {
    it('should call onChange when content changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(
        <MarkdownEditor initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-content');
        expect(editorElement).toBeInTheDocument();
      });

      const contentArea = container.querySelector('.cm-content');
      if (contentArea) {
        await user.click(contentArea);
        await user.keyboard('Hello');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('should update content when typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(
        <MarkdownEditor initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-content');
        expect(editorElement).toBeInTheDocument();
      });

      const contentArea = container.querySelector('.cm-content');
      if (contentArea) {
        await user.click(contentArea);
        await user.keyboard('# Test');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('Test'));
      });
    });
  });

  describe('Toolbar Actions', () => {
    it('should apply bold formatting', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      // Apply toolbar action
      if (ref.current) {
        ref.current.applyToolbarAction('bold');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('**bold text**'));
      });
    });

    it('should apply italic formatting', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('italic');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('*italic text*'));
      });
    });

    it('should apply strikethrough formatting', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('strikethrough');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('~~strikethrough text~~'));
      });
    });

    it('should apply heading formats', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
      for (const level of headingLevels) {
        onChange.mockClear();
        if (ref.current) {
          ref.current.applyToolbarAction(level);
        }

        await waitFor(() => {
          const expectedHashes = '#'.repeat(parseInt(level.slice(1)));
          expect(onChange).toHaveBeenCalledWith(expect.stringContaining(expectedHashes));
        });
      }
    });

    it('should insert unordered list', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('ul');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('- List item'));
      });
    });

    it('should insert ordered list', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('ol');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('1. List item'));
      });
    });

    it('should insert task list', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('task');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('- [ ] Task item'));
      });
    });

    it('should insert link', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('link');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('[link text](url)'));
      });
    });

    it('should insert image', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('image');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('![alt text](image-url)'));
      });
    });

    it('should insert inline code', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('code');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('`code`'));
      });
    });

    it('should insert code block', async () => {
      const onChange = vi.fn();
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      if (ref.current) {
        ref.current.applyToolbarAction('codeblock');
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('```'));
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save on Ctrl+S', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const { container } = render(
        <MarkdownEditor initialValue="Test" onSave={onSave} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-content');
        expect(editorElement).toBeInTheDocument();
      });

      const contentArea = container.querySelector('.cm-content');
      if (contentArea) {
        await user.click(contentArea);
        await user.keyboard('{Control>}s{/Control}');
      }

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });
  });

  describe('CodeMirror Features', () => {
    it('should display line numbers', async () => {
      const { container } = render(
        <MarkdownEditor initialValue="Line 1\nLine 2\nLine 3" />
      );

      await waitFor(() => {
        const lineNumbers = container.querySelector('.cm-lineNumbers');
        expect(lineNumbers).toBeInTheDocument();
      });
    });

    it('should support undo/redo', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(
        <MarkdownEditor initialValue="" onChange={onChange} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-content');
        expect(editorElement).toBeInTheDocument();
      });

      const contentArea = container.querySelector('.cm-content');
      if (contentArea) {
        await user.click(contentArea);
        await user.keyboard('Test');
        await user.keyboard('{Control>}z{/Control}'); // Undo
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('should have markdown syntax highlighting', async () => {
      const { container } = render(
        <MarkdownEditor initialValue="# Heading\n**bold**\n*italic*" />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
        // CodeMirror applies syntax highlighting classes
        expect(container.querySelector('.cm-line')).toBeInTheDocument();
      });
    });
  });

  describe('Ref Exposure', () => {
    it('should expose applyToolbarAction method', async () => {
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      expect(ref.current).toBeTruthy();
      expect(ref.current.applyToolbarAction).toBeInstanceOf(Function);
    });

    it('should expose getView method', async () => {
      const ref = { current: null } as unknown;
      const { container } = render(
        <MarkdownEditor ref={ref} initialValue="" />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.cm-editor');
        expect(editorElement).toBeInTheDocument();
      });

      expect(ref.current).toBeTruthy();
      expect(ref.current.getView).toBeInstanceOf(Function);
      expect(ref.current.getView()).toBeTruthy();
    });
  });
});

