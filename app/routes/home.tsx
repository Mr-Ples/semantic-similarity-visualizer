import type { Route } from "./+types/home"
import { useState, useEffect, useRef } from "react"
import type { WordData } from "~/lib/embeddings.utils"
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
    { title: "Polarized Words" },
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
  model: string
  openaiKey: string
  voyageKey: string
  googleKey: string
  northPole: string
  southPole: string
}
export default function Home({ loaderData }: Route.ComponentProps) {
  const [isMounted, setIsMounted] = useState(false)
  useMountEffect(() => {
    setIsMounted(true)
  })
  return isMounted ? <UI {...loaderData} /> : <div>Loading...</div>
}

function UI({ loaderData }: Route.ComponentProps) {
  const { value: settings, set: setSettings } = useLocalStorageValue<Settings>(
    "settings",
    {
      defaultValue: {
        model: "nomic-ai/nomic-embed-text-v1.5",
        openaiKey: "",
        voyageKey: "",
        googleKey: "",
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
  const [wordInput, setWordInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMyWords, setShowMyWords] = useState(false)
  const [savedLists, setSavedLists] = useState<any[]>([])
  const axisRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load saved words and poles
    const allWords = [...(words || []).map((w) => w.word)]
    if (settings.northPole && !allWords.includes(settings.northPole)) {
      allWords.push(settings.northPole)
    }
    if (settings.southPole && !allWords.includes(settings.southPole)) {
      allWords.push(settings.southPole)
    }
    if (allWords.length > 0) {
      loadSavedWords(allWords)
    }
  }, [settings.northPole, settings.southPole])

  useEffect(() => {
    // Ensure poles are included when component mounts
    if (words && words.length > 0) {
      ensurePolesIncluded()
    }
  }, [])

  useEffect(() => {
    // Load saved lists when component mounts
    loadSavedLists()
  }, [])

  const loadSavedWords = async (wordList: string[]) => {
    console.log("Loading saved words", wordList)
    setIsLoading(true)

    const formData = new FormData()
    formData.append("intent", "computeMultiple")
    formData.append("words", JSON.stringify(wordList))
    formData.append("model", settings.model)
    formData.append("openaiKey", settings.openaiKey)
    formData.append("voyageKey", settings.voyageKey)
    formData.append("googleKey", settings.googleKey)
    formData.append("northPole", settings.northPole)
    formData.append("southPole", settings.southPole)

    try {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
      } else if (Array.isArray(data)) {
        setWords(data)
      }
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
    }
  }

  const ensurePolesIncluded = async () => {
    const currentWords = words || []
    const wordStrings = currentWords.map(w => w.word)
    const allWords = [...wordStrings]
    
    if (settings.northPole && !wordStrings.includes(settings.northPole)) {
      allWords.push(settings.northPole)
    }
    if (settings.southPole && !wordStrings.includes(settings.southPole)) {
      allWords.push(settings.southPole)
    }
    
    if (allWords.length > wordStrings.length) {
      await loadSavedWords(allWords)
    }
  }

  const addWord = async (word: string) => {
    console.log("addWord", word)
    if (!word.trim()) return

    // Check if word already exists
    const trimmedWord = word.trim()
    const existingWords = words || []
    if (existingWords.some(w => w.word === trimmedWord)) {
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append("intent", "addWord")
    formData.append("word", trimmedWord)
    formData.append("model", settings.model)
    formData.append("openaiKey", settings.openaiKey)
    formData.append("voyageKey", settings.voyageKey)
    formData.append("googleKey", settings.googleKey)
    formData.append("northPole", settings.northPole)
    formData.append("southPole", settings.southPole)
    console.log(formData)
    try {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.error) {
      } else {
        const newWord = data as WordData
        const newWords = [...existingWords, newWord]
        setWords(newWords)
      }
      setIsLoading(false)
    } catch (error) {
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
    console.log("removeWord")
    const newWords = words?.filter((w) => w.word !== wordToRemove) || []
    setWords(newWords)
  }

  const saveWords = (customName?: string) => {
    if (!words || words.length === 0) return
    
    const currentLists = JSON.parse(localStorage.getItem("savedWordLists") || "[]")
    const timestamp = new Date().toISOString()
    const defaultName = `Word List ${currentLists.length + 1}`
    const wordList = {
      id: timestamp,
      name: customName || defaultName,
      timestamp: timestamp,
      words: words,
      northPole: settings.northPole,
      southPole: settings.southPole
    }
    
    const newLists = [...currentLists, wordList]
    localStorage.setItem("savedWordLists", JSON.stringify(newLists))
    setSavedLists(newLists)
  }

  const loadSavedList = (savedList: any) => {
    setWords(savedList.words)
    setSettings(prev => ({
      ...prev,
      northPole: savedList.northPole,
      southPole: savedList.southPole
    }))
    setShowMyWords(false)
  }

  const loadSavedLists = () => {
    const lists = JSON.parse(localStorage.getItem("savedWordLists") || "[]")
    setSavedLists(lists)
  }

  const deleteSavedList = (id: string) => {
    const currentLists = JSON.parse(localStorage.getItem("savedWordLists") || "[]")
    const filteredLists = currentLists.filter((list: any) => list.id !== id)
    localStorage.setItem("savedWordLists", JSON.stringify(filteredLists))
    setSavedLists(filteredLists)
  }

  const resetSettings = () => {
    const defaultSettings: Settings = {
      model: "nomic-ai/nomic-embed-text-v1.5",
      openaiKey: "",
      voyageKey: "",
      googleKey: "",
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
                Polarized Words
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div
            ref={axisRef}
            className="relative h-[80vh] overflow-y-auto overflow-x-hidden"
          >
            <WordAxis
              words={words}
              onRemoveWord={removeWord}
              northPole={settings.northPole}
              southPole={settings.southPole}
              onEditNorthPole={async (newPole) => {
                setSettings((prev) => ({ ...prev, northPole: newPole }))
                // Add the new pole to words if it doesn't exist
                if (!words?.some(w => w.word === newPole)) {
                  await addWord(newPole)
                }
              }}
              onEditSouthPole={async (newPole) => {
                setSettings((prev) => ({ ...prev, southPole: newPole }))
                // Add the new pole to words if it doesn't exist
                if (!words?.some(w => w.word === newPole)) {
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
                Embedding model:
              </label>
              <input
                value={settings.model}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, model: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OpenAI key:
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

            <p className="text-sm text-gray-500">
              (from{" "}
              <a
                href="https://huggingface.co/models?other=feature-extraction"
                className="text-indigo-600 hover:text-indigo-500"
              >
                Hugging Face
              </a>
              , must support ONNX. Refresh page to reload model)
            </p>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-200">
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Reset
            </button>
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
                    No saved word lists yet. Use the Save button to save your current word list.
                  </p>
                )
              }
              
              return savedLists.map((savedList: any) => (
                <div key={savedList.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{savedList.name}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(savedList.timestamp).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {savedList.words.length} words • {savedList.northPole} ↔ {savedList.southPole}
                      </p>
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
                    <span className="font-medium">Words:</span> {savedList.words.map((w: any) => w.word).join(", ")}
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
