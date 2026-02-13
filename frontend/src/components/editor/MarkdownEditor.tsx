import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  editable?: boolean;
}

/**
 * CodeMirror 6 based markdown editor component
 * Features:
 * - Syntax highlighting for markdown
 * - Line numbers
 * - Active line highlighting
 * - Undo/redo history
 * - Keyboard shortcuts
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialValue = '',
  onChange,
  onSave,
  editable = true,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

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
};

export default MarkdownEditor;
