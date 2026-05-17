interface Props {
  onClick: () => void;
  className?: string;
}

export function AiButton({ onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        'p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
      }
      aria-label="Open AI assistant"
      title="AI assistant"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    </button>
  );
}
