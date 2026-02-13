import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type { ToolbarAction } from './MarkdownToolbar';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  editable?: boolean;
}

export interface MarkdownEditorRef {
  applyToolbarAction: (action: ToolbarAction) => void;
  getView: () => EditorView | null;
}

/**
 * CodeMirror 6 based markdown editor component
 * Features:
 * - Syntax highlighting for markdown
 * - Line numbers
 * - Active line highlighting
 * - Undo/redo history
 * - Keyboard shortcuts
 * - Toolbar action support
 */
export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(({
  initialValue = '',
  onChange,
  onSave,
  editable = true,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

  /**
   * Apply a toolbar action to the editor
   */
  const applyToolbarAction = (action: ToolbarAction) => {
    const view = viewRef.current;
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);

    let changes;

    switch (action) {
      case 'bold':
        changes = {
          from,
          to,
          insert: `**${selectedText || 'bold text'}**`,
        };
        break;
      case 'italic':
        changes = {
          from,
          to,
          insert: `*${selectedText || 'italic text'}*`,
        };
        break;
      case 'strikethrough':
        changes = {
          from,
          to,
          insert: `~~${selectedText || 'strikethrough text'}~~`,
        };
        break;
      case 'h1':
        changes = {
          from,
          to,
          insert: `# ${selectedText || 'Heading 1'}`,
        };
        break;
      case 'h2':
        changes = {
          from,
          to,
          insert: `## ${selectedText || 'Heading 2'}`,
        };
        break;
      case 'h3':
        changes = {
          from,
          to,
          insert: `### ${selectedText || 'Heading 3'}`,
        };
        break;
      case 'h4':
        changes = {
          from,
          to,
          insert: `#### ${selectedText || 'Heading 4'}`,
        };
        break;
      case 'h5':
        changes = {
          from,
          to,
          insert: `##### ${selectedText || 'Heading 5'}`,
        };
        break;
      case 'h6':
        changes = {
          from,
          to,
          insert: `###### ${selectedText || 'Heading 6'}`,
        };
        break;
      case 'ul':
        changes = {
          from,
          to,
          insert: selectedText
            ? selectedText.split('\n').map(line => `- ${line}`).join('\n')
            : '- List item',
        };
        break;
      case 'ol':
        changes = {
          from,
          to,
          insert: selectedText
            ? selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n')
            : '1. List item',
        };
        break;
      case 'task':
        changes = {
          from,
          to,
          insert: selectedText
            ? selectedText.split('\n').map(line => `- [ ] ${line}`).join('\n')
            : '- [ ] Task item',
        };
        break;
      case 'link':
        changes = {
          from,
          to,
          insert: `[${selectedText || 'link text'}](url)`,
        };
        break;
      case 'image':
        changes = {
          from,
          to,
          insert: `![${selectedText || 'alt text'}](image-url)`,
        };
        break;
      case 'code':
        changes = {
          from,
          to,
          insert: `\`${selectedText || 'code'}\``,
        };
        break;
      case 'codeblock':
        changes = {
          from,
          to,
          insert: `\`\`\`\n${selectedText || 'code'}\n\`\`\``,
        };
        break;
      default:
        return;
    }

    view.dispatch({
      changes,
      selection: { anchor: from + changes.insert.length },
    });
    view.focus();
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    applyToolbarAction,
    getView: () => viewRef.current,
  }));


  useEffect(() => {
    if (!editorRef.current) return;

    // Define extensions
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        // Custom save shortcut (Ctrl+S / Cmd+S)
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            if (onSave) {
              onSave();
              return true;
            }
            return false;
          },
        },
        // Bold (Ctrl+B / Cmd+B)
        {
          key: 'Mod-b',
          preventDefault: true,
          run: () => {
            applyToolbarAction('bold');
            return true;
          },
        },
        // Italic (Ctrl+I / Cmd+I)
        {
          key: 'Mod-i',
          preventDefault: true,
          run: () => {
            applyToolbarAction('italic');
            return true;
          },
        },
        // Strikethrough (Ctrl+Shift+X / Cmd+Shift+X)
        {
          key: 'Mod-Shift-x',
          preventDefault: true,
          run: () => {
            applyToolbarAction('strikethrough');
            return true;
          },
        },
        // Code (Ctrl+` / Cmd+`)
        {
          key: 'Mod-`',
          preventDefault: true,
          run: () => {
            applyToolbarAction('code');
            return true;
          },
        },
        // Link (Ctrl+K / Cmd+K)
        {
          key: 'Mod-k',
          preventDefault: true,
          run: () => {
            applyToolbarAction('link');
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          const content = update.state.doc.toString();
          onChange(content);
        }
      }),
      EditorView.editable.of(editable),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
        },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          lineHeight: '1.6',
        },
        '.cm-content': {
          padding: '16px',
        },
        '.cm-line': {
          padding: '0 8px',
        },
        '&.cm-focused': {
          outline: 'none',
        },
      }),
    ];

    // Create editor state
    const startState = EditorState.create({
      doc: initialValue,
      extensions,
    });

    // Create editor view
    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setIsReady(true);

    // Cleanup
    return () => {
      view.destroy();
      viewRef.current = null;
      setIsReady(false);
    };
  }, []); // Only run on mount

  // Update content when initialValue changes (e.g., loading a different page)
  useEffect(() => {
    if (!viewRef.current || !isReady) return;

    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== initialValue) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: initialValue,
        },
      });
    }
  }, [initialValue, isReady]);

  // Update editable state
  useEffect(() => {
    if (!viewRef.current || !isReady) return;

    // Recreate view with new editable state by updating compartment
    // Note: In production, we should use compartments for better performance
    // For now, editable state is set on initialization
  }, [editable, isReady]);

  return (
    <div 
      ref={editorRef} 
      className="h-full overflow-auto border border-gray-300 rounded-md bg-white dark:bg-gray-900 dark:border-gray-700"
      data-testid="markdown-editor"
    />
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
