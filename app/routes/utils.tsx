import type { Route } from "./+types/utils"
import { useState } from "react"
import { Link } from "react-router"
import { getWordEmbedding } from "~/lib/embeddings.client"
import { cosineSimilarity } from "~/lib/embeddings.utils"
import { useLocalStorageValue, useMountEffect } from "@react-hookz/web"
import { ApiKeyInputs } from "~/components/ui/api-key-input"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { 
  EmbeddingModels,
  MODELS,
  type Settings,
  modelColorClasses 
} from "~/lib/constants"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Utils - Semantic Similarity Calculator" },
    {
      name: "description",
      content: "Calculate cosine similarity between two words",
    },
  ]
}

interface SimilarityResult {
  word1: string
  word2: string
  similarity: number
  timestamp: Date
  model: EmbeddingModels
}

export default function Utils() {
  const [isMounted, setIsMounted] = useState(false)
  useMountEffect(() => {
    setIsMounted(true)
  })
  
  const { value: settings, set: setSettings } = useLocalStorageValue<Settings>(
    "settings",
    {
      defaultValue: {
        selectedModels: [],
        keys: {},
        enableVerticalAxis: false,
      },
    }
  )
  
  return isMounted && settings ? (
    <UtilsUI settings={settings} setSettings={setSettings} />
  ) : (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  )
}

function UtilsUI({
  settings,
  setSettings,
}: {
  settings: Settings
  setSettings: any
}) {
  const [word1, setWord1] = useState("")
  const [word2, setWord2] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SimilarityResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const calculateSimilarity = async () => {
    if (!word1.trim() || !word2.trim()) {
      setError("Please enter both words")
      return
    }

    if (!settings.selectedModels.length) {
      setError("Please select at least one model in settings")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate similarity for all selected models
      const newResults: SimilarityResult[] = []
      
      for (const selectedModel of settings.selectedModels) {
        const model = selectedModel as EmbeddingModels
        const modelData = MODELS.find((m) => m.model === model)
        
        if (!modelData) {
          setError(`Invalid model selected: ${model}`)
          return
        }

        const key = settings.keys[modelData.service]
        if (!key) {
          setError(`No API key for ${modelData.label}. Please add it in settings.`)
          return
        }

        // Get embeddings for both words
        const data1 = await getWordEmbedding({
          word: word1.trim(),
          model: model,
          key: key,
        })
        
        const data2 = await getWordEmbedding({
          word: word2.trim(),
          model: model,
          key: key,
        })

        if (!data1?.embedding?.length || !data2?.embedding?.length) {
          setError(`Failed to get embeddings for ${model}`)
          return
        }

        // Calculate cosine similarity
        const similarity = cosineSimilarity(data1.embedding, data2.embedding)

        // Create result for this model
        const newResult: SimilarityResult = {
          word1: word1.trim(),
          word2: word2.trim(),
          similarity,
          timestamp: new Date(),
          model: model
        }

        newResults.push(newResult)
      }

      // Add all new results to history (newest first)
      setResults(prev => [...newResults, ...prev])
      setWord1("")
      setWord2("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate similarity")
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    setResults([])
  }

  const formatSimilarity = (similarity: number) => {
    const percentage = (similarity * 100).toFixed(2) + "%"
    const value = similarity.toFixed(4)
    return `${value} (${percentage})`
  }

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="max-md:hidden text-xl font-semibold text-gray-900">
                Similarity Calculator
              </h1>
            </div>
            <div className="flex gap-2">
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Home
              </Link>
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Input Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Enter Two Words
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Word 1
              </label>
              <input
                type="text"
                value={word1}
                onChange={(e) => setWord1(e.target.value)}
                placeholder="Enter first word..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && calculateSimilarity()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Word 2
              </label>
              <input
                type="text"
                value={word2}
                onChange={(e) => setWord2(e.target.value)}
                placeholder="Enter second word..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && calculateSimilarity()}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
              {error}
            </div>
          )}

          {/* Model Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Models
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center px-3 py-2 bg-gray-50 text-gray-700 text-sm font-medium rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                    + Add Model
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {Object.entries(settings.keys)
                    .filter(([_, key]) => key)
                    .map(([service, _]) => {
                      const model = MODELS.find(
                        (model) => model.service === service
                      )?.model
                      if (!model) {
                        return null
                      }
                      return (
                        <DropdownMenuItem
                          className="text-gray-500 hover:text-gray-700 text-sm"
                          key={service}
                          disabled={settings.selectedModels.includes(model)}
                          onClick={() => {
                            setSettings((prev: Settings) => {
                              return {
                                ...prev,
                                selectedModels: [...prev.selectedModels, model],
                              }
                            })
                          }}
                        >
                          {model}
                        </DropdownMenuItem>
                      )
                    })}
                  <DropdownMenuItem
                    className="text-gray-500 hover:text-gray-700 text-sm"
                    onClick={() => setShowSettings(true)}
                  >
                    + Configure API Keys
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {settings.selectedModels.map((model) => {
                const service = MODELS.find(
                  (modelData) => modelData.model === model
                )?.service
                const colorClasses = service ? modelColorClasses[service] : null
                const colorClass =
                  service && colorClasses ?
                    `${colorClasses.background} ${colorClasses.border} ${colorClasses.text}`
                  : "bg-gray-50 text-gray-700 border-gray-200"

                return (
                  <button
                    key={model + service}
                    className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border transition-all hover:opacity-75 ${colorClass}`}
                  >
                    {model}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setSettings((prev: Settings) => {
                          return {
                            ...prev,
                            selectedModels: prev.selectedModels.filter(m => m !== model),
                          }
                        })
                      }}
                      className="ml-2"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </button>
                )
              })}
            </div>
            
            {settings.selectedModels.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">
                No models selected. Add at least one model to calculate similarity.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={calculateSimilarity}
              disabled={loading || !word1.trim() || !word2.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? "Calculating..." : "Calculate Similarity"}
            </button>
            
            {results.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Results History
            </h2>
            
            <div className="space-y-3">
              {results.map((result, index) => {
                const modelData = MODELS.find((m) => m.model === result.model)
                const colorClasses = modelData ? modelColorClasses[modelData.service] : null
                const modelColorClass =
                  modelData && colorClasses ?
                    `${colorClasses.background} ${colorClasses.border} ${colorClasses.text}`
                  : "bg-gray-50 text-gray-700 border-gray-200"
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-medium text-gray-900">
                        "{result.word1}" ↔ "{result.word2}"
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${modelColorClass}`}
                      >
                        {result.model}
                      </span>
                      <div className="text-sm text-gray-500">
                        {formatTime(result.timestamp)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div 
                        className={`text-xl font-bold ${
                          result.similarity > 0.8 
                            ? 'text-green-600' 
                            : result.similarity > 0.5 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                        }`}
                      >
                        {formatSimilarity(result.similarity)}
                      </div>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            result.similarity > 0.8 
                              ? 'bg-green-500' 
                              : result.similarity > 0.5 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.max(result.similarity * 100, 5)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <ApiKeyInputs 
              settings={settings} 
              setSettings={setSettings} 
              showSettings={showSettings} 
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
