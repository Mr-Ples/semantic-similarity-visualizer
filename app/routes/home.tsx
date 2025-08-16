import type { Route } from "./+types/home"
import {
  useState,
  useEffect,
  useRef,
  Suspense,
  Component,
  type ReactNode,
  useMemo,
} from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { WordAxis } from "~/components/ui/word-axis"
import { ApiKeyInputs } from "~/components/ui/api-key-input"
import { useLocalStorageValue, useMountEffect } from "@react-hookz/web"
import {
  EmbeddingModels,
  MODELS,
  Pole,
  Services,
  modelColors,
  type PoleWordData,
  type Settings,
  type WordData,
} from "~/lib/constants"
import { EmbeddingAction } from "./api.embeddings.$action"
import { useSearchParams } from "react-router"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Semantic Similarity Visualizer" },
    {
      name: "description",
      content: "Visualize word embeddings on a good-evil axis",
    },
  ]
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.cloudflare.env.VALUE_FROM_CLOUDFLARE }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [isMounted, setIsMounted] = useState(false)
  useMountEffect(() => {
    setIsMounted(true)
  })
  const { value: settings, set: setSettings } = useLocalStorageValue<Settings>(
    "settings",
    {
      defaultValue: {
        selectedModels: [], // Default to Google model selected
        keys: {},
      },
    }
  )
  return isMounted && settings ?
      <ErrorBoundary>
        <UI setSettings={setSettings} settings={settings} {...loaderData} />
      </ErrorBoundary>
    : <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
}

// Test component that will crash when rendered
function CrashTestComponent({ shouldCrash }: { shouldCrash: boolean }) {
  if (shouldCrash) {
    throw new Error(
      "Test error for error boundary - this should trigger the export button!"
    )
  }
  return null
}

function UI({
  loaderData,
  settings,
  setSettings,
}: Route.ComponentProps & {
  settings: Settings
  setSettings: (settings: Settings) => void
}) {
  const { value: poles, set: setPoles } = useLocalStorageValue<PoleWordData[]>(
    "poles",
    {
      defaultValue: [
        { word: "evil", pole: Pole.LEFT, embeddings: {} },
        { word: "good", pole: Pole.RIGHT, embeddings: {} },
      ],
    }
  )
  const { value: words, set: setWords } = useLocalStorageValue<WordData[]>(
    "words",
    {
      defaultValue: [],
    }
  )

  useEffect(() => {
    console.log(words)
  }, [words])
  useEffect(() => {
    console.log(poles)
  }, [poles])

  const [wordInput, setWordInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMyWords, setShowMyWords] = useState(false)

  const { value: savedLists, set: setSavedLists } =
    useLocalStorageValue<any[]>("savedWordLists")

  const [shouldCrash, setShouldCrash] = useState(false)
  const axisRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useMountEffect(() => {
    if (!settings?.selectedModels?.length) {
      return
    }

    const refetchEmbeddings = async () => {
      // Refetch embeddings for words without embeddings on mount
      const wordsWithoutEmbeddings = words?.filter(
        (word) => !word?.embedding?.length && !!word?.model
      )
      const polesWithoutEmbeddings = poles?.filter((pole) =>
        settings.selectedModels.some((model) => !pole.embeddings[model]?.length)
      )

      const promises = []
      if (!!wordsWithoutEmbeddings?.length) {
        promises.push(refetchWordEmbeddings(wordsWithoutEmbeddings))
      }
      if (!!polesWithoutEmbeddings?.length) {
        promises.push(refetchPoleEmbeddings(polesWithoutEmbeddings))
      }

      if (promises.length > 0) {
        setIsLoading(true)
        try {
          await Promise.all(promises)
        } finally {
          setIsLoading(false)
        }
      }
    }

    refetchEmbeddings()
  })

  async function fetchWordEmbedding(wordData: WordData) {
    console.log("Adding word", wordData)
    if (!wordData.model) {
      throw Error("No model for word: " + wordData.word)
    }
    console.log(wordData)
    const modelData = MODELS.find((model) => model.model === wordData.model)
    if (!modelData) {
      throw Error("No model data for model: " + wordData.model)
    }

    const key = settings?.keys?.[modelData?.service]
    if (!key) {
      throw Error("No key for model: " + wordData.model)
    }
    const formData = new FormData()
    formData.append("word", wordData.word)
    formData.append("model", wordData.model)
    formData.append("key", key)
    const response = await fetch(
      `/api/embeddings/${EmbeddingAction.GET_EMBEDDING}`,
      {
        method: "POST",
        body: formData,
      }
    )
    const data = (await response.json()) as {
      success?: boolean
      data?: {
        embedding: number[]
        model: string
      }
      error?: string
      input?: {
        word: string
        model: EmbeddingModels
        key: string
      }
    }
    if (!data?.data?.embedding?.length) {
      setError(JSON.stringify(data))
      return
    }

    setWords((prev) => {
      return (
        prev?.map((word) => {
          if (word.word === wordData.word && word.model === wordData.model) {
            return {
              ...word,
              embedding: data?.data?.embedding,
            }
          }
          return word
        }) || []
      )
    })
  }

  const refetchWordEmbeddings = async (wordList: WordData[]) => {
    const promises = wordList.map((wordData, index) => {
      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            await fetchWordEmbedding(wordData)
            resolve()
          } catch (error) {
            console.error("Error fetching word embedding:", error)
            resolve()
          }
        }, 400 * index)
      })
    })
    await Promise.all(promises)
  }

  async function fetchPoleEmbedding(poleData: PoleWordData) {
    if (!settings?.selectedModels?.length) {
      throw Error("No selected models")
    }

    // Group models by service to avoid duplicate API calls
    const serviceGroups: { [service: string]: EmbeddingModels[] } = {}
    const modelsToFetch: EmbeddingModels[] = []

    for (const modelName of settings.selectedModels) {
      const model = modelName as EmbeddingModels

      // Skip if this model already has an embedding
      if (poleData.embeddings && poleData.embeddings[model]) {
        continue
      }

      const modelData = MODELS.find((m) => m.model === model)
      if (!modelData) {
        throw Error("No model data for model: " + model)
      }

      const key = settings?.keys?.[modelData.service]
      if (!key) {
        throw Error("No key for model: " + model)
      }

      modelsToFetch.push(model)
      if (!serviceGroups[modelData.service]) {
        serviceGroups[modelData.service] = []
      }
      serviceGroups[modelData.service].push(model)
    }

    // Fetch embeddings once per service
    for (const [service, modelsForService] of Object.entries(serviceGroups)) {
      // Use the first model for this service to make the API call
      const primaryModel = modelsForService[0]

      const formData = new FormData()
      formData.append("word", poleData.word)
      formData.append("model", primaryModel)
      formData.append("key", settings?.keys?.[service] || "")

      const response = await fetch(
        `/api/embeddings/${EmbeddingAction.GET_EMBEDDING}`,
        {
          method: "POST",
          body: formData,
        }
      )

      const data = (await response.json()) as {
        success?: boolean
        data?: {
          embedding: number[]
          model: string
        }
        error?: string
        input?: {
          word: string
          model: EmbeddingModels
          key: string
        }
      }

      if (!data?.data?.embedding?.length) {
        setError(JSON.stringify(data))
        continue
      }

      // Apply the same embedding to all models using this service
      setPoles((prev) => {
        return (
          prev?.map((pole) => {
            if (pole.word === poleData.word && pole.pole === poleData.pole) {
              const updatedEmbeddings = { ...pole.embeddings }
              // Set the embedding for all models from this service
              modelsForService.forEach((model) => {
                updatedEmbeddings[model] = data?.data?.embedding
              })

              return {
                ...pole,
                embeddings: updatedEmbeddings,
              }
            }
            return pole
          }) || []
        )
      })
    }
  }

  const refetchPoleEmbeddings = async (poleList: PoleWordData[]) => {
    const promises = poleList.map((poleData, index) => {
      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            await fetchPoleEmbedding(poleData)
            resolve()
          } catch (error) {
            console.error("Error fetching pole embedding:", error)
            resolve()
          }
        }, 400 * index)
      })
    })
    await Promise.all(promises)
  }

  const fetchEmbeddingsForNewModel = async (model: string) => {
    try {
      setIsLoading(true)

      // Get unique pole words that don't have embeddings for this model
      const uniquePoleWords =
        poles?.reduce((acc, pole) => {
          if (!pole.embeddings?.[model]?.length) {
            const existingPole = acc.find((p) => p.word === pole.word)
            if (!existingPole) {
              acc.push(pole)
            }
          }
          return acc
        }, [] as PoleWordData[]) || []

      // Get all unique words and create new WordData entries for the new model
      const uniqueWordTexts =
        words?.reduce((acc, word) => {
          if (!acc.includes(word.word)) {
            acc.push(word.word)
          }
          return acc
        }, [] as string[]) || []

      // Create new WordData entries for the new model
      const newWordsForModel = uniqueWordTexts.map((wordText) => ({
        word: wordText,
        model: model as EmbeddingModels,
        embedding: undefined,
      }))

      // Add the new word entries to the words array
      setWords((prevWords) => {
        const existingWords = prevWords || []
        const wordsToAdd = newWordsForModel.filter(
          (newWord) =>
            !existingWords.some(
              (existing) =>
                existing.word === newWord.word &&
                existing.model === newWord.model
            )
        )
        return [...existingWords, ...wordsToAdd]
      })

      const promises = []

      // Fetch pole embeddings
      if (uniquePoleWords.length > 0) {
        promises.push(refetchPoleEmbeddings(uniquePoleWords))
      }

      // Fetch word embeddings for the new model entries
      if (newWordsForModel.length > 0) {
        promises.push(refetchWordEmbeddings(newWordsForModel))
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }
    } catch (error) {
      console.error("Error fetching embeddings for new model:", error)
      setError(`Failed to fetch embeddings for ${model}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    console.log(
      poles?.map((pole) => ({
        ...pole,
        embeddings: undefined,
      }))
    )
  }, [poles])
  useEffect(() => {
    console.log(
      words?.map((word) => ({
        ...word,
        embedding: word?.embedding?.length ? true : false,
      }))
    )
  }, [words])

  const addWord = async (word: string) => {
    console.log("addWord", word)
    // Check if word already exists
    const trimmedWord = word.trim()
    const existingWords = words || []

    // Check if word already exists for any model
    if (existingWords.some((w) => w.word === trimmedWord)) {
      setError("Word already exists")
      return
    }

    setIsLoading(true)
    try {
      const selectedModels = settings.selectedModels
      const newWords = [...existingWords]

      // Generate embeddings for each selected model
      for (const selectedModel of selectedModels) {
        const modelData = MODELS.find((m) => m.model === selectedModel)
        if (!modelData) {
          console.error("No model data for model:", selectedModel)
          continue
        }

        const key = settings?.keys?.[modelData.service]
        if (!key) {
          setError(
            `No API key for ${modelData.label}. Please add it in settings.`
          )
          continue
        }

        const formData = new FormData()
        formData.append("word", trimmedWord)
        formData.append("model", selectedModel)
        formData.append("key", key)

        const response = await fetch(
          `/api/embeddings/${EmbeddingAction.GET_EMBEDDING}`,
          {
            method: "POST",
            body: formData,
          }
        )

        const data = (await response.json()) as {
          success?: boolean
          data?: {
            embedding: number[]
            model: string
          }
          error?: string
        }

        if (!data.success || !data.data?.embedding?.length) {
          setError(data.error || "Failed to get embedding")
          break
        }

        const newWord: WordData = {
          word: trimmedWord,
          embedding: data.data.embedding,
          model: selectedModel as EmbeddingModels,
        }
        newWords.push(newWord)
      }

      setWords(newWords)
      setError(null)
    } catch (error) {
      setError("Failed to add word")
      console.error("Error adding word:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddWord = () => {
    if (wordInput.trim()) {
      addWord(wordInput)
      setWordInput("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddWord()
    }
  }

  const clearAllWords = () => {
    console.log("clearAllWords")
    setWords([])
  }

  const removeWord = (wordToRemove: string) => {
    console.log("removeWord", wordToRemove)
    console.log("words", words)
    // const newWords = words?.filter((w) => w.word !== wordToRemove) || []
    // console.log("newWords", newWords)
    setWords((prev) => {
      return prev?.filter((w) => w.word !== wordToRemove) || []
    })
  }

  const clearWordsForModel = (modelToRemove: string) => {
    console.log("clearWordsForModel", modelToRemove)
    setWords((prev) => {
      return prev?.filter((w) => w.model !== modelToRemove) || []
    })
  }

  const clearPolesForModel = (modelToRemove: string) => {
    console.log("clearPolesForModel", modelToRemove)
    setPoles((prev) => {
      return (
        prev?.map((pole) => {
          const updatedEmbeddings = { ...pole.embeddings }
          delete updatedEmbeddings[modelToRemove as EmbeddingModels]
          return {
            ...pole,
            embeddings: updatedEmbeddings,
          }
        }) || []
      )
    })
  }

  const saveWords = (customName?: string, replaceId?: string | null) => {
    if (!words || words.length === 0) return
    const currentLists = savedLists || []
    const timestamp = new Date().toISOString()
    const defaultName = `Word List ${currentLists.length + 1}`
    const wordList = {
      id: replaceId || timestamp,
      name: customName || defaultName,
      timestamp: timestamp,
      words: words, // All words with their models and embeddings
      poles: poles, // All poles with their embeddings for all models
      selectedModels: settings.selectedModels, // Track which models were active
    }
    let newLists
    if (replaceId) {
      // Replace existing list
      newLists = currentLists.map((list: any) =>
        list.id === replaceId ? wordList : list
      )
    } else {
      // Add new list
      newLists = [...currentLists, wordList]
    }
    setSavedLists(newLists)
  }

  const loadSavedList = (savedList: any) => {
    console.log(savedList)
    // Load words (all models)
    if (savedList.words) {
      setWords(savedList.words)
    }
    
    // Load poles with all their embeddings
    if (savedList.poles) {
      setPoles(savedList.poles)
    } else if (savedList.northPole && savedList.southPole) {
      // Backward compatibility for old format
      setPoles([
        { word: savedList.southPole, pole: Pole.LEFT, embeddings: {} },
        { word: savedList.northPole, pole: Pole.RIGHT, embeddings: {} },
      ])
    }
    
    // Update selected models if available
    if (savedList.selectedModels) {
      setSettings(prev => ({
        ...prev,
        selectedModels: savedList.selectedModels
      }))
    }
    
    setShowMyWords(false)
  }

  const deleteSavedList = (id: string) => {
    const currentLists = savedLists || []
    const filteredLists = currentLists.filter((list: any) => list.id !== id)
    setSavedLists(filteredLists)
  }

  const exportCurrentWords = () => {
    if (!words || words.length === 0) return
    const timestamp = new Date().toISOString()
    const currentList = {
      id: timestamp,
      name: `Word List ${timestamp}`,
      timestamp: timestamp,
      words: words, // All words with their models and embeddings
      poles: poles, // All poles with their embeddings for all models
      selectedModels: settings.selectedModels, // Track which models were active
      // Backward compatibility fields
      northPole: poles?.find(p => p.pole === Pole.RIGHT)?.word || "good",
      southPole: poles?.find(p => p.pole === Pole.LEFT)?.word || "evil",
    }
    
    const dataStr = JSON.stringify(currentList, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${currentList.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportWordList = (savedList: any) => {
    const dataStr = JSON.stringify(savedList, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${savedList.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const importWordList = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedList = JSON.parse(e.target?.result as string)
        // Validate the imported data structure
        if (!importedList.words || !Array.isArray(importedList.words)) {
          setError("Invalid file format: missing words array")
          return
        }
        // Generate new ID and timestamp for imported list
        const timestamp = new Date().toISOString()
        const listToImport = {
          ...importedList,
          id: timestamp,
          timestamp: timestamp,
          name:
            importedList.name ?
              `${importedList.name} (Imported)`
            : `Imported List`,
        }
        const currentLists = savedLists || []
        const newLists = [...currentLists, listToImport]
        setSavedLists(newLists)
        setError(null)
      } catch (error) {
        setError("Failed to parse imported file")
      }
    }
    reader.readAsText(file)
    // Reset the input
    event.target.value = ""
  }

  const [searchParams] = useSearchParams()
  return (
    <div className="min-h-screen bg-gray-50">
      <CrashTestComponent shouldCrash={shouldCrash} />
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="max-md:hidden text-xl font-semibold text-gray-900">
                Semantic Similarity Visualizer
              </h1>
            </div>
            <div className="flex gap-2">
              {searchParams.has("debug") && (
                <button
                  onClick={() => {
                    setShouldCrash(true)
                  }}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Test Error
                </button>
              )}
              <button
                onClick={() => setShowMyWords(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                My Words
              </button>
              <button
                onClick={() => setShowAbout(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                About
              </button>
              <button
                onClick={() => {
                  setShowSettings(true)
                }}
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

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => setError(null)}
                    className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto max-md:p-0 px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div
            ref={axisRef}
            className="relative h-[80vh] overflow-y-auto overflow-x-hidden"
          >
            <WordAxis
              words={words || []}
              onRemoveWord={removeWord}
              poles={poles || []}
              settings={settings}
              onEditNorthPole={async (value: string) => {
                setIsLoading(true)
                try {
                  // Update the pole and clear old embeddings
                  setPoles((prev) => {
                    return (
                      prev?.map((pole) => {
                        if (pole.pole === Pole.RIGHT) {
                          return { ...pole, word: value, embeddings: {} }
                        }
                        return pole
                      }) || []
                    )
                  })

                  // Fetch embeddings for the new pole word
                  const newPole = {
                    word: value,
                    pole: Pole.RIGHT,
                    embeddings: {},
                  }
                  await fetchPoleEmbedding(newPole)
                } catch (error) {
                  setError("Failed to update north pole")
                  console.error("Error updating north pole:", error)
                } finally {
                  setIsLoading(false)
                }
              }}
              onEditSouthPole={async (value: string) => {
                setIsLoading(true)
                try {
                  // Update the pole and clear old embeddings
                  setPoles((prev) => {
                    return (
                      prev?.map((pole) => {
                        if (pole.pole === Pole.LEFT) {
                          return { ...pole, word: value, embeddings: {} }
                        }
                        return pole
                      }) || []
                    )
                  })

                  // Fetch embeddings for the new pole word
                  const newPole = {
                    word: value,
                    pole: Pole.LEFT,
                    embeddings: {},
                  }
                  await fetchPoleEmbedding(newPole)
                } catch (error) {
                  setError("Failed to update south pole")
                  console.error("Error updating south pole:", error)
                } finally {
                  setIsLoading(false)
                }
              }}
              wordInput={wordInput}
              onWordInputChange={setWordInput}
              onAddWord={handleAddWord}
              onClearAll={clearAllWords}
              onSaveWords={saveWords}
              onExportWords={exportCurrentWords}
              isLoading={isLoading}
              onKeyPress={handleKeyPress}
              setSettings={setSettings}
              onShowSettings={() => {
                setShowSettings(true)
              }}
              onClearWordsForModel={clearWordsForModel}
              onClearPolesForModel={clearPolesForModel}
              fetchEmbeddingsForNewModel={fetchEmbeddingsForNewModel}
            />
          </div>
        </div>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ApiKeyInputs
              settings={settings}
              setSettings={setSettings}
              showSettings={showSettings}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>About</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-gray-600">
              This site is a vibe coded revamp of the original concept found
              here:{" "}
              <a
                href="https://github.com/DefenderOfBasic/good-and-evil-concepts"
                className="text-indigo-600 hover:text-indigo-500"
              >
                github.com/DefenderOfBasic/good-and-evil-concepts
              </a>
            </p>
            <p className="text-gray-600">
              Source code for this project:{" "}
              <a
                href="https://github.com/Mr-Ples/semantic-similarity-visualizer"
                className="text-indigo-600 hover:text-indigo-500"
              >
                https://github.com/Mr-Ples/semantic-similarity-visualizer
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMyWords} onOpenChange={setShowMyWords}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Saved Word Lists</DialogTitle>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 mr-2 bg-blue-600 text-white text-sm rounded-md "
              >
                Import List
              </button>
            </div>
          </DialogHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={importWordList}
            style={{ display: "none" }}
          />

          <div className="space-y-4">
            {(() => {
              if (!savedLists?.length) {
                return (
                  <p className="text-gray-500 text-center py-8">
                    No saved word lists yet. Use the Save button to save your
                    current word list.
                  </p>
                )
              }

              return savedLists.map((savedList: any) => (
                <div
                  key={savedList.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {savedList.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(savedList.timestamp).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-full">
                          {(() => {
                            const uniqueWords = [...new Set(savedList.words.map((w: any) => w.word))]
                            return uniqueWords.length
                          })()} words
                        </span>
                        <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                          {savedList.poles ? 
                            `${savedList.poles.find((p: any) => p.pole === "LEFT")?.word || savedList.southPole || "evil"} ↔ ${savedList.poles.find((p: any) => p.pole === "RIGHT")?.word || savedList.northPole || "good"}` :
                            `${savedList.southPole || "evil"} ↔ ${savedList.northPole || "good"}`
                          }
                        </span>
                        {savedList.selectedModels ? (
                          savedList.selectedModels.map((model: string) => {
                            const modelData = MODELS.find(m => m.model === model)
                            const colorClass = modelData ? modelColors[modelData.service] : "bg-gray-50 text-gray-700 border-gray-200"
                            return (
                              <span key={model} className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${colorClass}`}>
                                {model}
                              </span>
                            )
                          })
                        ) : (
                          (() => {
                            const model = savedList.words[0]?.model
                            const modelData = MODELS.find(m => m.model === model)
                            const colorClass = modelData ? modelColors[modelData.service] : "bg-gray-50 text-gray-700 border-gray-200"
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${colorClass}`}>
                                {model || "Unknown"}
                              </span>
                            )
                          })()
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadSavedList(savedList)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => exportWordList(savedList)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => deleteSavedList(savedList.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Words:</span>{" "}
                    {(() => {
                      const uniqueWords = [...new Set(savedList.words.map((w: any) => w.word))]
                      return uniqueWords.join(", ")
                    })()}
                  </div>
                </div>
              ))
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  exportAllData = () => {
    try {
      // Get all saved word lists
      const savedWordLists = JSON.parse(
        localStorage.getItem("savedWordLists") || "[]"
      )

      // Get current words and settings
      const currentWords = JSON.parse(localStorage.getItem("words") || "[]")
      const settings = JSON.parse(localStorage.getItem("settings") || "{}")
      // Create export data
      const exportData = {
        exportedAt: new Date().toISOString(),
        savedWordLists: savedWordLists,
        currentWords: currentWords,
        settings: {
          ...settings,
          // Remove API keys for security
          openaiKey: settings.openaiKey ? "[REDACTED]" : "",
          voyageKey: settings.voyageKey ? "[REDACTED]" : "",
          googleKey: settings.googleKey ? "[REDACTED]" : "",
          huggingFaceKey: settings.huggingFaceKey ? "[REDACTED]" : "",
          mistralKey: settings.mistralKey ? "[REDACTED]" : "",
        },
      }

      // Create and download file
      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `semantic-visualizer-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export data:", error)
      alert("Failed to export data. Please try again.")
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <div className="border rounded-md p-6">
              <div className="flex justify-center mb-4">
                <svg
                  className="h-12 w-12"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">
                Oops! Something is broken
              </h3>
              <p className="text-sm mb-4">
                The lazy developer probably made a breaking change
              </p>
              <p className="text-sm font-bold mb-4">
                Please clear cache below
              </p>
              <p className="text-sm mb-4">
                You can also report any bugs here: <a className="text-blue-500" href="https://github.com/Mr-Ples/semantic-similarity-visualizer/issues" target="_blank" rel="noopener noreferrer">@https://github.com/Mr-Ples/semantic-similarity-visualizer/issues</a>
              </p>
              {this.state.error && (
                <div className="border rounded p-3 mb-4 text-left">
                  <p className="text-xs font-mono break-all">
                    <strong>Error:</strong> {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer">
                        Stack trace
                      </summary>
                      <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <button
                  onClick={this.exportAllData}
                  className="w-full  cursor-pointer px-4 py-2 rounded-md text-sm font-medium border mb-2"
                >
                  Export Word Lists
                </button>
                <button
                  onClick={() => {
                    window.location.reload()
                  }}
                  className="w-full cursor-pointer px-4 py-2 rounded-md text-sm font-medium border"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    const confirmed = window.confirm(
                      "⚠️ WARNING: This will permanently delete ALL data including:\n\n" +
                        "• All saved word lists\n" +
                        "• Current words and embeddings\n" +
                        "• API keys (you'll need to re-enter them)\n" +
                        "• All settings and preferences\n\n" +
                        "Make sure you have exported your word lists first!\n\n" +
                        "Are you sure you want to clear all cache?"
                    )
                    if (confirmed) {
                      localStorage.clear()
                      window.location.reload()
                    }
                  }}
                  className="w-full  cursor-pointer px-4 py-2 rounded-md text-sm font-medium border"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
