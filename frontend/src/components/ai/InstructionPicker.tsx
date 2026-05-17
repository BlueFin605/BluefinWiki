import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createInstruction,
  listInstructions,
  type AiInstructionSummary,
} from '../../services/AiInstructionsService';

interface Props {
  selectedGuids: string[];
  loadedGuids: string[];
  onToggle: (guid: string) => void;
  onAfterCreate: () => void;
}

export function InstructionPicker({
  selectedGuids,
  loadedGuids,
  onToggle,
  onAfterCreate,
}: Props) {
  const [instructions, setInstructions] = useState<AiInstructionSummary[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    listInstructions()
      .then((list) => {
        if (!cancelled) setInstructions(list);
      })
      .catch((err) => {
        console.warn('Failed to load AI instructions:', err);
        if (!cancelled) setInstructions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const guid = await createInstruction(title);
      setIsOpen(false);
      setNewTitle('');
      onAfterCreate();
      navigate(`/pages/${guid}`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedSet = new Set(selectedGuids);
  const loadedSet = new Set(loadedGuids);
  const selectedInOrder = (instructions ?? []).filter((i) => selectedSet.has(i.guid));

  return (
    <div className="border-b border-gray-200 px-3 py-2 relative">
      <div className="flex items-center gap-1.5 flex-wrap">
        {selectedInOrder.length === 0 && (
          <span className="text-xs text-gray-500">No instructions attached</span>
        )}
        {selectedInOrder.map((inst) => {
          const isLoaded = loadedSet.has(inst.guid);
          return (
            <button
              key={inst.guid}
              type="button"
              onClick={() => !isLoaded && onToggle(inst.guid)}
              disabled={isLoaded}
              className={
                isLoaded
                  ? 'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200 cursor-not-allowed'
                  : 'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }
              title={
                isLoaded
                  ? 'In context — clear with New chat to remove'
                  : 'Click to remove from selection'
              }
            >
              {isLoaded && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="truncate max-w-[10rem]">{inst.title}</span>
              {!isLoaded && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          );
        })}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100"
          title="Attach instructions"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Instructions
        </button>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 left-3 right-3 mt-2 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto"
        >
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500">
            Attach instructions
          </div>
          {instructions === null ? (
            <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
          ) : instructions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              No instructions yet. Create one below — it becomes a wiki page you can edit
              like any other.
            </div>
          ) : (
            <ul className="py-1">
              {instructions.map((inst) => {
                const isSelected = selectedSet.has(inst.guid);
                const isLoaded = loadedSet.has(inst.guid);
                return (
                  <li key={inst.guid}>
                    <button
                      type="button"
                      onClick={() => !isLoaded && onToggle(inst.guid)}
                      disabled={isLoaded}
                      className={
                        isLoaded
                          ? 'w-full text-left px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2'
                          : 'w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2'
                      }
                      title={isLoaded ? 'In context — clear with New chat to remove' : ''}
                    >
                      <span
                        className={
                          isSelected || isLoaded
                            ? 'w-4 h-4 rounded border border-blue-500 bg-blue-500 flex items-center justify-center text-white'
                            : 'w-4 h-4 rounded border border-gray-300'
                        }
                      >
                        {(isSelected || isLoaded) && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate">{inst.title}</span>
                      {isLoaded && (
                        <span className="text-[10px] uppercase tracking-wide text-blue-600">In context</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-gray-100 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="New instruction title…"
                disabled={isCreating}
                className="flex-1 text-sm rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newTitle.trim() || isCreating}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
            {createError && (
              <p className="mt-1 text-xs text-red-600">{createError}</p>
            )}
            <p className="mt-1 text-[11px] text-gray-500">
              Creates a child page under "AI Instructions". You'll be taken to the editor
              to fill it in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
