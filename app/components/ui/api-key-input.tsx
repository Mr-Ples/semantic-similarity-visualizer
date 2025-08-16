import { MODELS, Services } from "~/lib/constants";

interface ApiKeyInputsProps {
  selectedService: string;
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onServiceChange: (service: string) => void;
}

export function ApiKeyInputs({ selectedService, settings, onChange, onServiceChange }: ApiKeyInputsProps) {
  const selectedModel = MODELS.find(model => model.service === selectedService);
  
  if (!selectedModel) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Embedding Service:
        </label>
        <select
          value={selectedService}
          onChange={(e) => onServiceChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {MODELS.map((model) => (
            <option key={model.model} value={model.service}>
              {model.label} ({model.model})
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {selectedModel.label} API key:
        </label>
        <input
          type="password"
          value={settings[selectedModel.key] || ""}
          onChange={(e) => onChange(selectedModel.key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder={`Enter your ${selectedModel.label} API key`}
        />
        {selectedModel.service === Services.GOOGLE && (
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
    </div>
  );
}
