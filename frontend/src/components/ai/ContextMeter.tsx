import type { AiUsage } from '../../services/AiService';

interface Props {
  usage: AiUsage | null;
}

export function ContextMeter({ usage }: Props) {
  if (!usage) {
    return (
      <div className="px-4 py-2 border-b border-gray-200 text-xs text-gray-500">
        Context: ready
      </div>
    );
  }

  const percent = Math.round(usage.percent);
  const color =
    percent < 60 ? 'bg-blue-500' : percent < 85 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="px-4 py-2 border-b border-gray-200">
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>Context window</span>
        <span>
          {usage.used.toLocaleString()} / {usage.quota.toLocaleString()} ({percent}%)
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
