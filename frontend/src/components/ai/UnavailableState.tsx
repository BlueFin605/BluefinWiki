import type { AiAvailability } from './useAi';

interface Props {
  availability: AiAvailability;
}

export function UnavailableState({ availability }: Props) {
  if (availability === 'downloading') {
    return (
      <div className="p-4 text-sm text-gray-700">
        <h3 className="font-semibold mb-2">Downloading on-device AI…</h3>
        <p className="text-gray-600">
          Chrome is downloading the Gemini Nano model. This can take several minutes on first
          use. You can track progress at{' '}
          <code className="bg-gray-100 px-1 rounded">chrome://components</code> under
          “Optimization Guide On Device Model”.
        </p>
      </div>
    );
  }

  if (availability === 'downloadable') {
    return (
      <div className="p-4 text-sm text-gray-700">
        <h3 className="font-semibold mb-2">AI is ready to download</h3>
        <p className="text-gray-600">
          Send your first message and Chrome will download the on-device model in the
          background. After that, it works offline.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 text-sm text-gray-700 space-y-3">
      <div>
        <h3 className="font-semibold text-gray-900">AI assistant unavailable</h3>
        <p className="mt-1 text-gray-600">
          The wiki uses Chrome’s built-in Prompt API (Gemini Nano). Everything runs
          on-device — nothing leaves your browser. To enable it:
        </p>
      </div>

      <ol className="list-decimal pl-5 space-y-2 text-gray-700">
        <li>
          Use <strong>Chrome 138+ on desktop</strong> (not Safari/Firefox, not mobile).
          Needs ~22&nbsp;GB free disk and a GPU with 4&nbsp;GB+ VRAM.
        </li>
        <li>
          Enable two flags, then restart Chrome:
          <ul className="list-disc pl-5 mt-1 text-gray-600">
            <li>
              <code className="bg-gray-100 px-1 rounded">
                chrome://flags/#prompt-api-for-gemini-nano
              </code>{' '}
              → <strong>Enabled</strong>
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">
                chrome://flags/#optimization-guide-on-device-model
              </code>{' '}
              → <strong>Enabled BypassPerfRequirement</strong>
            </li>
          </ul>
        </li>
        <li>
          Check the model is installed:{' '}
          <code className="bg-gray-100 px-1 rounded">chrome://components</code> →
          “Optimization Guide On Device Model” should show a non-zero version.
        </li>
        <li>
          Verify in DevTools console:{' '}
          <code className="bg-gray-100 px-1 rounded">
            await LanguageModel.availability()
          </code>{' '}
          should return <code className="bg-gray-100 px-1 rounded">"available"</code>.
        </li>
      </ol>

      <p className="text-xs text-gray-500">
        Detected state:{' '}
        <code className="bg-gray-100 px-1 rounded">{availability}</code>
      </p>
    </div>
  );
}
