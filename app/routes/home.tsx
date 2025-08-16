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
import { ApiKeyInputs } from "~/components/ui/api-key-input"
import { useLocalStorageValue, useMountEffect } from "@react-hookz/web"
import { MODELS, Services } from "~/lib/constants"

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

  exportAllData = () => {
    try {
      // Get all saved word lists
      const savedWordLists = JSON.parse(
        localStorage.getItem("savedWordLists") || "[]"
      )

      // Get current words and settings
      const currentWords = JSON.parse(localStorage.getItem("words") || "[]")
      const settings = JSON.parse(localStorage.getItem("settings") || "{}")
      const poleEmbeddings = JSON.parse(
        localStorage.getItem("poleEmbeddings") || "{}"
      )

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
        poleEmbeddings: poleEmbeddings,
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
              <div className="space-y-2">
                <button
                  onClick={this.exportAllData}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-2"
                >
                  Export Word Lists
                </button>
                <button
                  onClick={() => {
                    window.location.reload()
                  }}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const [isMounted, setIsMounted] = useState(false)
  useMountEffect(() => {
    setIsMounted(true)
  })
  const { value: settings, set: setSettings } = useLocalStorageValue<Settings>(
    "settings",
    {
      defaultValue: {
        selectedService: Services.GOOGLE,
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
  // Check if API key is configured for selected service
  const hasValidApiKey = () => {
    return MODELS.some((modelData) => settings[modelData.key].trim() !== "")
  }
  const [tempSettings, setTempSettings] = useState(settings)
  const { value: words, set: setWords } = useLocalStorageValue<WordData[]>(
    "words",
    {
      defaultValue: [],
    }
  )

  const wordsModel = useMemo(() => {
    return words?.[0]?.model
  }, [words])

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
  const [shouldCrash, setShouldCrash] = useState(false)
  const axisRef = useRef<HTMLDivElement>(null)
  const previousModelRef = useRef<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const data = await response.json() as {
        error?: string
        wordData?: WordData[]
      }
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
      const data = await response.json() as {
        error?: string
        wordData?: WordData[]
      }
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
      const data = await response.json() as {
        error?: string
        wordData?: WordData
      }
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

  const saveWords = (customName?: string, replaceId?: string | null) => {
    if (!words || words.length === 0) return

    const currentLists = JSON.parse(
      localStorage.getItem("savedWordLists") || "[]"
    )
    const timestamp = new Date().toISOString()
    const defaultName = `Word List ${currentLists.length + 1}`
    const wordList = {
      id: replaceId || timestamp,
      name: customName || defaultName,
      timestamp: timestamp,
      words: words,
      poleEmbeddings: poleEmbeddings,
      northPole: settings.northPole,
      southPole: settings.southPole,
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

  const exportCurrentWords = () => {
    if (!words || words.length === 0) return

    const timestamp = new Date().toISOString()
    const currentList = {
      id: timestamp,
      name: `Word List ${timestamp}`,
      timestamp: timestamp,
      words: words,
      poleEmbeddings: poleEmbeddings,
      northPole: settings.northPole,
      southPole: settings.southPole,
    }

    exportWordList(currentList)
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

        const currentLists = JSON.parse(
          localStorage.getItem("savedWordLists") || "[]"
        )
        const newLists = [...currentLists, listToImport]
        localStorage.setItem("savedWordLists", JSON.stringify(newLists))
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

  const hasValidTempApiKey = () => {
    return MODELS.some((modelData) => tempSettings[modelData.key].trim() !== "")
  }

  const selectedServiceData =
    MODELS.find((model) => model.service === tempSelectedService) || MODELS[0]

  return hasValidApiKey() ?
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
                {/* <button
                onClick={() => {
                  setShouldCrash(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Test Error
              </button> */}
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
                selectedService={settings.selectedService}
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
                onExportWords={exportCurrentWords}
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
              <ApiKeyInputs
                selectedService={selectedServiceData.service}
                settings={settings || {}}
                onChange={(key, value) =>
                  setSettings((prev) => ({
                    ...prev,
                    [key]: value,
                  }))
                }
                onServiceChange={(service) => setTempSelectedService(service)}
              />

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
                      {savedList.words.map((w: any) => w.word).join(", ")}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    : <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                Please configure your API key to get started
              </p>
            </div>

            <div className="space-y-4">
              <ApiKeyInputs
                selectedService={tempSettings.selectedService}
                settings={tempSettings}
                onChange={(key, value) =>
                  setTempSettings((prev) => ({
                    ...prev,
                    [key]: value,
                  }))
                }
                onServiceChange={(service) =>
                  setTempSettings((prev) => ({
                    ...prev,
                    selectedService: service,
                  }))
                }
              />

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    if (hasValidTempApiKey()) {
                      // console.log(tempSettings)
                      // console.log(settings)
                      setSettings(tempSettings)
                    }
                  }}
                  disabled={!hasValidTempApiKey()}
                  className={`px-6 py-2 rounded-md font-medium ${
                    hasValidTempApiKey() ?
                      "bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
}
