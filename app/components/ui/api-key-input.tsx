import { useEffect, useState } from "react"
import { MODELS, Services, type Settings } from "~/lib/constants"

export function ApiKeyInputs({
  settings,
  setSettings,
  showSettings,
}: {
  settings: Settings
  setSettings: any
  showSettings: boolean
}) {
  const [inputs, setInputs] = useState<Settings>(settings)

  useEffect(() => {
    if (showSettings) {
      setInputs(settings)
    }
    if (!showSettings) {
      setSettings(inputs)
    }
  }, [showSettings])

  return (
    <div className="space-y-4">
      {MODELS.map((model) => (
        <div key={model.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {model.label} API key:
          </label>
          <input
            type="password"
            value={inputs.keys?.[model.service]}
            onChange={(e) => {
              setInputs((prev) => {
                return {
                  ...prev,
                  keys: {
                    ...prev.keys,
                    [model.service]: e.target.value,
                  },
                }
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder={`Enter your ${model.label} API key`}
          />
          {model.service === Services.GOOGLE && (
            <p className="mt-2 text-sm text-gray-600">
              gemini-embedding-001 ranks at the top of the{" "}
              <a
                href="https://huggingface.co/spaces/mteb/leaderboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-500"
              >
                MTEB leaderboard
              </a>
              . Get a free API key{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-500"
              >
                here
              </a>
              .
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
