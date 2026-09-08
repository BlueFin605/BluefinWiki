import {
  type AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  type ElementRef,
  type OnDestroy,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { Compartment, EditorState, type Extension, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'ul'
  | 'ol'
  | 'task'
  | 'link'
  | 'code'
  | 'codeblock';

export interface CursorContext {
  from: number;
  to: number;
  query: string;
  coords: { top: number; left: number; bottom: number; right: number } | null;
}

@Component({
  selector: 'wiki-codemirror',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="wiki-codemirror"></div>`,
  styles: [`
    :host { display: block; height: 100%; }
    .wiki-codemirror { height: 100%; overflow: auto; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: #ffffff; }
    :host ::ng-deep .cm-editor { height: 100%; font-size: 14px; }
    :host ::ng-deep .cm-scroller { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; line-height: 1.6; }
    :host ::ng-deep .cm-content { padding: 16px; }
    :host ::ng-deep .cm-line { padding: 0 8px; }
    :host ::ng-deep .cm-focused { outline: none; }
  `],
})
export class WikiCodemirror implements AfterViewInit, OnDestroy {
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly value = model<string>('');
  readonly editable = input<boolean>(true);
  readonly save = output<void>();
  readonly cursorContext = output<CursorContext | null>();

  private view: EditorView | null = null;
  private suppressEmit = false;
  private readonly editableCompartment = new Compartment();
  private lastCursorContext: CursorContext | null = null;

  constructor() {
    effect(() => {
      const incoming = this.value();
      const view = this.view;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === incoming) return;
      this.suppressEmit = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: incoming } });
      this.suppressEmit = false;
    });

    effect(() => {
      const editable = this.editable();
      const view = this.view;
      if (!view) return;
      view.dispatch({
        effects: this.editableCompartment.reconfigure(EditorView.editable.of(editable)),
      });
    });
  }

  ngAfterViewInit(): void {
    this.view = new EditorView({
      state: this.makeState(this.value()),
      parent: this.hostRef().nativeElement,
    });
  }

  ngOnDestroy(): void {
    this.view?.destroy();
    this.view = null;
  }

  getView(): EditorView | null {
    return this.view;
  }

  applyAction(action: ToolbarAction): void {
    const view = this.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.doc.sliceString(from, to);
    const wrap = (open: string, close = open, fallback = ''): { from: number; to: number; insert: string } =>
      ({ from, to, insert: `${open}${selected || fallback}${close}` });
    const prefix = (p: string, fallback = ''): { from: number; to: number; insert: string } =>
      ({ from, to, insert: `${p}${selected || fallback}` });
    let changes: { from: number; to: number; insert: string };
    switch (action) {
      case 'bold': changes = wrap('**', '**', 'bold text'); break;
      case 'italic': changes = wrap('*', '*', 'italic text'); break;
      case 'strikethrough': changes = wrap('~~', '~~', 'strikethrough text'); break;
      case 'h1': changes = prefix('# ', 'Heading 1'); break;
      case 'h2': changes = prefix('## ', 'Heading 2'); break;
      case 'h3': changes = prefix('### ', 'Heading 3'); break;
      case 'h4': changes = prefix('#### ', 'Heading 4'); break;
      case 'h5': changes = prefix('##### ', 'Heading 5'); break;
      case 'h6': changes = prefix('###### ', 'Heading 6'); break;
      case 'ul': changes = prefix('- ', 'List item'); break;
      case 'ol': changes = prefix('1. ', 'List item'); break;
      case 'task': changes = prefix('- [ ] ', 'Task'); break;
      case 'link': changes = wrap('[', '](url)', 'link text'); break;
      case 'code': changes = wrap('`', '`', 'code'); break;
      case 'codeblock': changes = wrap('```\n', '\n```', 'code'); break;
    }
    view.dispatch({ changes, selection: { anchor: from + changes.insert.length } });
    view.focus();
  }

  insertText(from: number, to: number, text: string): void {
    const view = this.view;
    if (!view) return;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  private makeState(doc: string): EditorState {
    const onSave = this.save;
    const valueModel = this.value;
    const isSuppressed = (): boolean => this.suppressEmit;
    const updateCursorContext = (view: EditorView): void => this.computeCursorContext(view);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      // Formatting chords, mirroring the markdown toolbar actions. Wrapped in
      // `Prec.high` so the editor explicitly wins the keys it shares with
      // CodeMirror defaults (e.g. Mod-i / selectParentSyntax) and with the
      // global Search shortcut (Mod-k) while the editor is focused — precedence
      // is now explicit, not dependent on this keymap's array position ahead of
      // defaultKeymap.
      Prec.high(
        keymap.of([
          {
            key: 'Mod-b',
            preventDefault: true,
            run: () => {
              this.applyAction('bold');
              return true;
            },
          },
          {
            key: 'Mod-i',
            preventDefault: true,
            run: () => {
              this.applyAction('italic');
              return true;
            },
          },
          {
            key: 'Mod-`',
            preventDefault: true,
            run: () => {
              this.applyAction('code');
              return true;
            },
          },
          {
            key: 'Mod-Shift-x',
            preventDefault: true,
            run: () => {
              this.applyAction('strikethrough');
              return true;
            },
          },
          {
            key: 'Mod-k',
            preventDefault: true,
            run: () => {
              this.applyAction('link');
              return true;
            },
          },
        ]),
      ),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSave.emit();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !isSuppressed()) {
          valueModel.set(u.state.doc.toString());
        }
        if (u.docChanged || u.selectionSet) {
          updateCursorContext(u.view);
        }
      }),
      this.editableCompartment.of(EditorView.editable.of(this.editable())),
    ];
    return EditorState.create({ doc, extensions });
  }

  private computeCursorContext(view: EditorView): void {
    const { from, to } = view.state.selection.main;
    if (from !== to) {
      this.emitCursorContext(null);
      return;
    }
    const line = view.state.doc.lineAt(from);
    const upToCursor = line.text.slice(0, from - line.from);
    const match = /\[\[([^\]]*?)$/.exec(upToCursor);
    if (!match) {
      this.emitCursorContext(null);
      return;
    }
    const matchStart = line.from + match.index;
    const query = match[1];
    let coords: CursorContext['coords'] = null;
    try {
      const r = view.coordsAtPos(from);
      if (r) {
        coords = { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
      }
    } catch {
      coords = null;
    }
    this.emitCursorContext({ from: matchStart, to: from, query, coords });
  }

  private emitCursorContext(next: CursorContext | null): void {
    const prev = this.lastCursorContext;
    const same =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev.from === next.from &&
        prev.to === next.to &&
        prev.query === next.query);
    if (same) return;
    this.lastCursorContext = next;
    this.cursorContext.emit(next);
  }
}
