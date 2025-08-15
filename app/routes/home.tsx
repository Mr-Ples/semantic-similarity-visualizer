import type { Route } from "./+types/home"
import {
  useState,
  useEffect,
  useRef,
  Suspense,
  Component,
  type ReactNode,
} from "react"
import type { WordData } from "~/lib/embeddings.client"
import {
  calculateAllWordPositions,
  type WordPosition,
} from "~/lib/embeddings.client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { WordAxis } from "~/components/ui/word-axis"
import { useLocalStorageValue, useMountEffect } from "@react-hookz/web"

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

interface Settings {
  selectedService: string
  openaiKey: string
  voyageKey: string
  googleKey: string
  huggingFaceKey: string
  mistralKey: string
  northPole: string
  southPole: string
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-red-50 border border-red-200 rounded-md p-6">
              <div className="flex justify-center mb-4">
                <svg
                  className="h-12 w-12 text-red-400"
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
              <h3 className="text-lg font-medium text-red-800 mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-red-700 mb-4">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              <button
                onClick={() => {
                  window.location.reload()
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  localStorage.clear()
                  window.location.reload()
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [isMounted, setIsMounted] = useState(false)
  useMountEffect(() => {
    setIsMounted(true)
  })
  return isMounted ?
      <ErrorBoundary>
        <UI {...loaderData} />
      </ErrorBoundary>
    : <div>Loading...</div>
}

function UI({ loaderData }: Route.ComponentProps) {
  const { value: settings, set: setSettings } = useLocalStorageValue<Settings>(
    "settings",
    {
      defaultValue: {
        selectedService: "mistral",
        openaiKey: "",
        voyageKey: "",
        googleKey: "",
        huggingFaceKey: "",
        mistralKey: "",
        northPole: "good",
        southPole: "evil",
      },
    }
  )

  // Guard against undefined settings during initial render
  if (!settings) {
    return <div>Loading...</div>
  }

  const { value: words, set: setWords } = useLocalStorageValue<WordData[]>(
    "words",
    {
      defaultValue: [],
    }
  )
  const { value: poleEmbeddings, set: setPoleEmbeddings } =
    useLocalStorageValue<{
      northPole: WordData | null
      southPole: WordData | null
    }>("poleEmbeddings", {
      defaultValue: { northPole: null, southPole: null },
    })

  const [wordPositions, setWordPositions] = useState<WordPosition[]>([])
  const [wordInput, setWordInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMyWords, setShowMyWords] = useState(false)
  const [tempSelectedService, setTempSelectedService] = useState(
    settings.selectedService
  )
  const [savedLists, setSavedLists] = useState<any[]>([])
  const axisRef = useRef<HTMLDivElement>(null)
  const previousModelRef = useRef<string>("")

  useEffect(() => {
    // Load pole embeddings if we don't have them or if poles changed
    const missingPoles = []
    if (
      settings.northPole &&
      (!poleEmbeddings?.northPole ||
        poleEmbeddings.northPole.word !== settings.northPole)
    ) {
      missingPoles.push(settings.northPole)
    }
    if (
      settings.southPole &&
      (!poleEmbeddings?.southPole ||
        poleEmbeddings.southPole.word !== settings.southPole)
    ) {
      missingPoles.push(settings.southPole)
    }

    if (missingPoles.length > 0) {
      loadPoleEmbeddings(missingPoles)
    }
  }, [settings.northPole, settings.southPole])

  useEffect(() => {
    // Load pole embeddings on mount if they don't exist or don't have embeddings
    if (settings) {
      const missingPoles = []
      if (
        settings.northPole &&
        (!poleEmbeddings?.northPole ||
          !poleEmbeddings.northPole.embedding ||
          poleEmbeddings.northPole.embedding.length === 0)
      ) {
        missingPoles.push(settings.northPole)
      }
      if (
        settings.southPole &&
        (!poleEmbeddings?.southPole ||
          !poleEmbeddings.southPole.embedding ||
          poleEmbeddings.southPole.embedding.length === 0)
      ) {
        missingPoles.push(settings.southPole)
      }

      if (missingPoles.length > 0) {
        loadPoleEmbeddings(missingPoles)
      }
    }
  }, [settings, poleEmbeddings])

  useEffect(() => {
    // Calculate word positions whenever words or pole embeddings change
    if (
      words &&
      words.length > 0 &&
      poleEmbeddings?.northPole?.embedding &&
      poleEmbeddings?.southPole?.embedding
    ) {
      // Combine regular words with pole embeddings
      const allWords = [...words]
      if (
        poleEmbeddings.northPole &&
        !words.some((w) => w.word === poleEmbeddings.northPole!.word)
      ) {
        allWords.push(poleEmbeddings.northPole)
      }
      if (
        poleEmbeddings.southPole &&
        !words.some((w) => w.word === poleEmbeddings.southPole!.word)
      ) {
        allWords.push(poleEmbeddings.southPole)
      }

      const positions = calculateAllWordPositions(
        allWords,
        poleEmbeddings.southPole.embedding,
        poleEmbeddings.northPole.embedding
      )
      setWordPositions(positions)
    } else {
      // Clear word positions when there are no words or missing embeddings
      setWordPositions([])
    }
  }, [words, poleEmbeddings])

  useEffect(() => {
    // Load saved lists when component mounts
    loadSavedLists()
  }, [])

  useEffect(() => {
    // Effect to handle model changes
    if (words && words.length > 0) {
      const currentModel = words[0].model

      // If we have a previous model and it's different from current model
      if (
        previousModelRef.current &&
        previousModelRef.current !== currentModel
      ) {
        // Save current words with model tag before clearing
        const currentLists = JSON.parse(
          localStorage.getItem("savedWordLists") || "[]"
        )
        const timestamp = new Date().toISOString()
        const wordList = {
          id: timestamp,
          name: `Auto-saved (${previousModelRef.current})`,
          timestamp: timestamp,
          words: words.filter(
            (word) => word.model === previousModelRef.current
          ),
          poleEmbeddings: poleEmbeddings,
          northPole: settings.northPole,
          southPole: settings.southPole,
        }

        const newLists = [...currentLists, wordList]
        localStorage.setItem("savedWordLists", JSON.stringify(newLists))
        setSavedLists(newLists)

        // Clear words that were generated with the previous model
        const wordsToKeep = words.filter((word) => word.model === currentModel)
        setWords(wordsToKeep)
      }

      // Update the previous model reference
      previousModelRef.current = currentModel
    }
  }, [words, settings.selectedService])

  useEffect(() => {
    // Refetch embeddings for words without embeddings on mount
    if (words && words.length > 0) {
      const wordsWithoutEmbeddings = words.filter(
        (word) => !word.embedding || word.embedding.length === 0
      )
      if (wordsWithoutEmbeddings.length > 0) {
        refetchWordEmbeddings(wordsWithoutEmbeddings.map((w) => w.word))
      }
    }
  }, [])

  const loadPoleEmbeddings = async (poleWords: string[]) => {
    console.log("Loading pole embeddings", poleWords)
    setIsLoading(true)

    const formData = new FormData()
    formData.append("intent", "computeMultiple")
    formData.append("words", JSON.stringify(poleWords))
    formData.append("selectedService", settings.selectedService)
    formData.append("openaiKey", settings.openaiKey)
    formData.append("voyageKey", settings.voyageKey)
    formData.append("googleKey", settings.googleKey)
    formData.append("huggingFaceKey", settings.huggingFaceKey)
    formData.append("mistralKey", settings.mistralKey)

    try {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else if (Array.isArray(data)) {
        // Update pole embeddings
        const newPoleEmbeddings = { ...poleEmbeddings }
        data.forEach((wordData: WordData) => {
          if (wordData.word === settings.northPole) {
            newPoleEmbeddings.northPole = wordData
          }
          if (wordData.word === settings.southPole) {
            newPoleEmbeddings.southPole = wordData
          }
        })
        setPoleEmbeddings(newPoleEmbeddings)
        setError(null)
      }
      setIsLoading(false)
    } catch (error) {
      setError("Failed to load pole embeddings")
      setIsLoading(false)
    }
  }

  const refetchWordEmbeddings = async (wordList: string[]) => {
    console.log("Refetching embeddings for words", wordList)
    setIsLoading(true)

    const formData = new FormData()
    formData.append("intent", "computeMultiple")
    formData.append("words", JSON.stringify(wordList))
    formData.append("selectedService", settings.selectedService)
    formData.append("openaiKey", settings.openaiKey)
    formData.append("voyageKey", settings.voyageKey)
    formData.append("googleKey", settings.googleKey)
    formData.append("huggingFaceKey", settings.huggingFaceKey)
    formData.append("mistralKey", settings.mistralKey)

    try {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else if (Array.isArray(data)) {
        // Update words with new embeddings
        const newWords =
          words?.map((word) => {
            const updatedWord = data.find((w: WordData) => w.word === word.word)
            return updatedWord || word
          }) || []
        setWords(newWords)
        setError(null)
      }
      setIsLoading(false)
    } catch (error) {
      setError("Failed to refetch word embeddings")
      setIsLoading(false)
    }
  }

  const addWord = async (word: string) => {
    console.log("addWord", word)
    if (!word.trim()) return

    // Check if word already exists
    const trimmedWord = word.trim()
    const existingWords = words || []
    if (existingWords.some((w) => w.word === trimmedWord)) {
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append("intent", "addWord")
    formData.append("word", trimmedWord)
    formData.append("selectedService", settings.selectedService)
    formData.append("openaiKey", settings.openaiKey)
    formData.append("voyageKey", settings.voyageKey)
    formData.append("googleKey", settings.googleKey)
    formData.append("huggingFaceKey", settings.huggingFaceKey)
    formData.append("mistralKey", settings.mistralKey)

    try {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else {
        const newWord = data as WordData
        const newWords = [...existingWords, newWord]
        setWords(newWords)
        setError(null)
      }
      setIsLoading(false)
    } catch (error) {
      setError("Failed to add word")
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
    window.location.reload()
  }

  const removeWord = (wordToRemove: string) => {
    console.log("removeWord", wordToRemove)
    console.log("words", words)
    const newWords = words?.filter((w) => w.word !== wordToRemove) || []
    console.log("newWords", newWords)
    setWords((prev) => {
      return prev?.filter((w) => w.word !== wordToRemove) || []
    })
  }

  const saveWords = (customName?: string) => {
    if (!words || words.length === 0) return

    const currentLists = JSON.parse(
      localStorage.getItem("savedWordLists") || "[]"
    )
    const timestamp = new Date().toISOString()
    const defaultName = `Word List ${currentLists.length + 1}`
    const wordList = {
      id: timestamp,
      name: customName || defaultName,
      timestamp: timestamp,
      words: words,
      poleEmbeddings: poleEmbeddings,
      northPole: settings.northPole,
      southPole: settings.southPole,
    }

    const newLists = [...currentLists, wordList]
    localStorage.setItem("savedWordLists", JSON.stringify(newLists))
    setSavedLists(newLists)
  }

  const loadSavedList = (savedList: any) => {
    console.log(savedList)

    // Check if the saved list has a consistent model
    if (savedList.words && savedList.words.length > 0) {
      const model = savedList.words[0].model
      const hasConsistentModel = savedList.words.every(
        (word: WordData) => word.model === model
      )

      if (!hasConsistentModel) {
        setError("Cannot load saved list: words have inconsistent models")
        return
      }

      // Update settings to match the saved list's poles
      setSettings((prev) => ({
        ...prev,
        northPole: savedList.northPole,
        southPole: savedList.southPole,
      }))
    }

    setWords(savedList.words)
    if (savedList.poleEmbeddings) {
      setPoleEmbeddings(savedList.poleEmbeddings)
    }
    setShowMyWords(false)
  }

  const loadSavedLists = () => {
    const lists = JSON.parse(localStorage.getItem("savedWordLists") || "[]")
    setSavedLists(lists)
  }

  const deleteSavedList = (id: string) => {
    const currentLists = JSON.parse(
      localStorage.getItem("savedWordLists") || "[]"
    )
    const filteredLists = currentLists.filter((list: any) => list.id !== id)
    localStorage.setItem("savedWordLists", JSON.stringify(filteredLists))
    setSavedLists(filteredLists)
  }

  const resetSettings = () => {
    const defaultSettings: Settings = {
      selectedService: "mistral",
      openaiKey: "",
      voyageKey: "",
      googleKey: "",
      huggingFaceKey: "",
      mistralKey: "",
      northPole: "good",
      southPole: "evil",
    }
    setSettings(defaultSettings)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Semantic Similarity Visualizer
              </h1>
            </div>
            <div className="flex gap-2">
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
                  setTempSelectedService(settings.selectedService)
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {words && words.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Current model:</span>{" "}
              {words[0].model}
            </p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm">
          <div
            ref={axisRef}
            className="relative h-[80vh] overflow-y-auto overflow-x-hidden"
          >
            <WordAxis
              key={wordPositions?.length + "positions"}
              words={wordPositions}
              onRemoveWord={removeWord}
              northPole={settings.northPole}
              southPole={settings.southPole}
              onEditNorthPole={async (newPole) => {
                const oldPole = settings.northPole
                setSettings((prev) => ({ ...prev, northPole: newPole }))
                // Remove the old pole from words if it exists
                if (oldPole && words?.some((w) => w.word === oldPole)) {
                  const newWords = words.filter((w) => w.word !== oldPole)
                  setWords(newWords)
                }
                // Add the new pole to words if it doesn't exist
                if (!words?.some((w) => w.word === newPole)) {
                  await addWord(newPole)
                }
              }}
              onEditSouthPole={async (newPole) => {
                const oldPole = settings.southPole
                setSettings((prev) => ({ ...prev, southPole: newPole }))
                // Remove the old pole from words if it exists
                console.log(oldPole)
                console.log(words)
                if (oldPole && words?.some((w) => w.word === oldPole)) {
                  setWords((prev) => {
                    const oldWords = prev?.map((word) => word.word)
                    console.log(oldWords)
                    const newWords = prev
                      ?.map((word) => word.word)
                      ?.filter((w) => w !== oldPole)
                    console.log(newWords)
                    return prev
                  })
                }
                // Add the new pole to words if it doesn't exist
                if (!words?.some((w) => w.word === newPole)) {
                  await addWord(newPole)
                }
              }}
              wordInput={wordInput}
              onWordInputChange={setWordInput}
              onAddWord={handleAddWord}
              onClearAll={clearAllWords}
              onSaveWords={saveWords}
              isLoading={isLoading}
              onKeyPress={handleKeyPress}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embedding Service:
              </label>
              <select
                value={tempSelectedService}
                onChange={(e) => setTempSelectedService(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="mistral">Mistral AI (mistral-embed)</option>
                <option value="openai">OpenAI (text-embedding-3-large)</option>
                <option value="voyage">Voyage AI (voyage-3-large)</option>
                <option value="google">Google (gemini-embedding-001)</option>
                <option value="huggingface">
                  Hugging Face (Qwen/Qwen3-Embedding-8B)
                </option>
              </select>
            </div>

            {tempSelectedService === "openai" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API key:
                </label>
                <input
                  type="password"
                  value={settings.openaiKey}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      openaiKey: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {tempSelectedService === "voyage" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voyage API key:
                </label>
                <input
                  type="password"
                  value={settings.voyageKey}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      voyageKey: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {tempSelectedService === "google" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google API key:
                </label>
                <input
                  type="password"
                  value={settings.googleKey}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      googleKey: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {tempSelectedService === "huggingface" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hugging Face API key:
                </label>
                <input
                  type="password"
                  value={settings.huggingFaceKey}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      huggingFaceKey: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            {tempSelectedService === "mistral" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mistral API key:
                </label>
                <input
                  type="password"
                  value={settings.mistralKey}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      mistralKey: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    selectedService: tempSelectedService,
                  }))
                  setShowSettings(false)
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Select
              </button>
            </div>
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMyWords} onOpenChange={setShowMyWords}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Saved Word Lists</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {(() => {
              if (savedLists.length === 0) {
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
                          {savedList.words.length} words
                        </span>
                        <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                          {savedList.northPole} ↔ {savedList.southPole}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
                          {savedList.words[0]?.model || "Unknown"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadSavedList(savedList)}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Load
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
                    {savedList.words.map((w: any) => w.word).join(", ")}
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
