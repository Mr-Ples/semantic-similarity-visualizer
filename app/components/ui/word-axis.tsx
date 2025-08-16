import { useState, useEffect, useRef, useMemo } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  EmbeddingModels,
  modelColors,
  MODELS,
  Pole,
  type PoleWordData,
  type Settings,
  type WordData,
} from "~/lib/constants"
import { calculateAllWordPositions } from "~/lib/embeddings.utils"
import { toast } from "sonner"

interface PolePopupProps {
  isOpen: boolean
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder: string
  focusColor: string
  position: "left" | "right"
}

export function WordAxis({
  words,
  settings,

  onRemoveWord,
  onEditNorthPole,
  onEditSouthPole,
  wordInput,
  onWordInputChange,
  onAddWord,
  onClearAll,
  onSaveWords,
  onExportWords,
  isLoading,
  onKeyPress,
  setSettings,
  onShowSettings,
  onClearWordsForModel,
  onClearPolesForModel,
  fetchEmbeddingsForNewModel,

  poles,
}: {
  words: WordData[]
  settings: Settings

  onRemoveWord: (word: string) => void
  onEditNorthPole: (value: string) => void
  onEditSouthPole: (value: string) => void
  wordInput: string
  onWordInputChange: (value: string) => void
  onAddWord: () => void
  onClearAll: () => void
  onSaveWords: (customName?: string, replaceId?: string | null) => void
  onExportWords: () => void
  isLoading: boolean
  onKeyPress: (e: React.KeyboardEvent) => void
  setSettings: any
  onShowSettings: () => void
  onClearWordsForModel: (model: string) => void
  onClearPolesForModel: (model: string) => void
  fetchEmbeddingsForNewModel: (model: string) => Promise<void>

  poles: PoleWordData[]
}) {
  const [showPolePopup, setShowPolePopup] = useState<"left" | "right" | null>(
    null
  )
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [tempPoles, setTempPoles] = useState(poles)
  const [showModelRemovalConfirmation, setShowModelRemovalConfirmation] =
    useState(false)
  const [modelToRemove, setModelToRemove] = useState<string | null>(null)
  const [hoveredModel, setHoveredModel] = useState<string | null>(null)

  useEffect(() => {
    setTempPoles(poles)
  }, [poles])

  const selectedModels = settings?.selectedModels || []

  const handlePoleSave = () => {
    if (!selectedModels.length) {
      toast.info("Add a model first")
      return
    }

    // Find what changed and call appropriate parent function
    const leftPole = tempPoles.find((p) => p.pole === Pole.LEFT)
    const rightPole = tempPoles.find((p) => p.pole === Pole.RIGHT)
    const originalLeft = poles.find((p) => p.pole === Pole.LEFT)
    const originalRight = poles.find((p) => p.pole === Pole.RIGHT)

    if (leftPole && leftPole.word !== originalLeft?.word) {
      onEditSouthPole(leftPole.word)
    }

    if (rightPole && rightPole.word !== originalRight?.word) {
      onEditNorthPole(rightPole.word)
    }

    setShowPolePopup(null)
  }

  const handlePoleCancel = () => {
    setTempPoles(poles)
    setShowPolePopup(null)
  }

  const handleClearConfirm = () => {
    onClearAll()
    setShowClearConfirmation(false)
  }

  const handleClearCancel = () => {
    setShowClearConfirmation(false)
  }

  const handleModelRemovalClick = (model: string) => {
    setModelToRemove(model)
    setShowModelRemovalConfirmation(true)
  }

  const handleModelRemovalConfirm = () => {
    if (modelToRemove) {
      // Clear words and poles for this model
      onClearWordsForModel(modelToRemove)
      onClearPolesForModel(modelToRemove)

      // Remove the model from selected models
      setSettings((prev: Settings) => {
        return {
          ...prev,
          selectedModels: prev.selectedModels.filter(
            (m) => m !== modelToRemove
          ),
        }
      })
    }
    setShowModelRemovalConfirmation(false)
    setModelToRemove(null)
  }

  const handleModelRemovalCancel = () => {
    setShowModelRemovalConfirmation(false)
    setModelToRemove(null)
  }

  const handleSaveClick = () => {
    const savedLists = JSON.parse(
      localStorage.getItem("savedWordLists") || "[]"
    )
    setSaveName(`Word List ${savedLists.length + 1}`)
    setSelectedListId(null)
    setShowSaveDialog(true)
  }

  const handleSaveConfirm = () => {
    onSaveWords(saveName, selectedListId)
    setShowSaveDialog(false)
  }

  const handleSaveCancel = () => {
    setShowSaveDialog(false)
    setSelectedListId(null)
  }

  // Calculate positions for visualization
  const positionedWords = useMemo(() => {
    if (!words || words.length === 0) {
      return []
    }

    // Find pole data from the poles array
    const leftPoleData = poles.find((p) => p.pole === Pole.LEFT)
    const rightPoleData = poles.find((p) => p.pole === Pole.RIGHT)

    if (!leftPoleData || !rightPoleData) {
      return []
    }

    // Calculate positions for each selected model separately
    const allModelPositions = []

    for (const selectedModel of selectedModels) {
      if (!leftPoleData.embeddings || !rightPoleData.embeddings) continue

      const leftEmbedding = (leftPoleData.embeddings as any)[selectedModel]
      const rightEmbedding = (rightPoleData.embeddings as any)[selectedModel]

      if (
        !leftEmbedding ||
        !rightEmbedding ||
        leftEmbedding.length === 0 ||
        rightEmbedding.length === 0
      ) {
        continue
      }

      // Filter words to only include those from this specific model
      const wordsForThisModel = words.filter(
        (word) =>
          word.model === selectedModel &&
          word.embedding &&
          word.embedding.length > 0
      )

      if (wordsForThisModel.length === 0) {
        continue
      }

      // Create WordData objects for the poles so they can be included in calculations
      const leftPoleWordData: WordData = {
        word: leftPoleData.word,
        embedding: leftEmbedding,
        model: selectedModel as EmbeddingModels,
      }
      const rightPoleWordData: WordData = {
        word: rightPoleData.word,
        embedding: rightEmbedding,
        model: selectedModel as EmbeddingModels,
      }

      // Include poles in the calculation to get proper min/max range
      const allWordsIncludingPoles = [
        ...wordsForThisModel,
        leftPoleWordData,
        rightPoleWordData,
      ]

      const allWordPositions = calculateAllWordPositions(
        allWordsIncludingPoles,
        leftEmbedding,
        rightEmbedding
      )

      const allPositions = allWordPositions.map(
        (d) => d.northDistance / (d.southDistance + d.northDistance)
      )
      const minPos = Math.min(...allPositions)
      const maxPos = Math.max(...allPositions)

      // Filter out the pole words for display (we only want regular words positioned)
      const wordPositions = allWordPositions.filter(
        (wp) =>
          wp.wordData.word !== leftPoleData.word &&
          wp.wordData.word !== rightPoleData.word
      )

      const modelWordPositions = wordPositions.map((wordPosition) => {
        const rawPosition =
          wordPosition.northDistance /
          (wordPosition.southDistance + wordPosition.northDistance)
        const normalizedPosition =
          ((rawPosition - minPos) / (maxPos - minPos)) * 100

        // Debug logging
        console.log(
          `${wordPosition.wordData.word} (${selectedModel}): north=${wordPosition.northDistance.toFixed(3)}, south=${wordPosition.southDistance.toFixed(3)}, raw=${rawPosition.toFixed(3)}, norm=${normalizedPosition.toFixed(1)}`
        )

        return {
          wordData: wordPosition.wordData,
          position: normalizedPosition,
          verticalOffset: 0,
        }
      })

      // Add these positions to the accumulated results
      allModelPositions.push(...modelWordPositions)
    }

    // Sort all positions by position to check for overlaps
    allModelPositions.sort((a, b) => a.position - b.position)

    // Group overlapping words and assign vertical positions
    const overlapGroups = []

    for (let i = 0; i < allModelPositions.length; i++) {
      const currentWord = allModelPositions[i]
      let addedToGroup = false

      // Try to add to existing group
      for (const group of overlapGroups) {
        const distance = Math.abs(currentWord.position - group[0].position)
        if (distance < 10) {
          group.push(currentWord)
          addedToGroup = true
          break
        }
      }

      // Create new group if not added to existing
      if (!addedToGroup) {
        overlapGroups.push([currentWord])
      }
    }

    // Assign vertical positions to each group
    for (const group of overlapGroups) {
      if (group.length === 1) {
        group[0].verticalOffset = 0
      } else {
        // Distribute words in group around center
        for (let i = 0; i < group.length; i++) {
          if (i === 0) {
            group[i].verticalOffset = 0 // Center
          } else if (i === 1) {
            group[i].verticalOffset = -40 // Above
          } else if (i === 2) {
            group[i].verticalOffset = 40 // Below
          } else {
            // Additional words alternate above and below
            const offset =
              i % 2 === 1 ?
                -(Math.floor(i / 2) + 1) * 40
              : (Math.floor(i / 2) + 1) * 40
            group[i].verticalOffset = offset
          }
        }
      }
    }

    return allModelPositions
  }, [words, poles])

  function PolePopup({
    isOpen,
    value,
    onChange,
    onSave,
    onCancel,
    placeholder,
    focusColor,
    position,
  }: PolePopupProps) {
    const popupRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          popupRef.current &&
          !popupRef.current.contains(event.target as Node)
        ) {
          onCancel()
        }
      }

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside)
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [isOpen, onCancel])

    if (!isOpen) return null

    return (
      <div
        className={`absolute top-full ${position === "left" ? "left-0" : "right-0"} mt-2 z-50`}
        ref={popupRef}
      >
        <div className="bg-white border border-gray-300 rounded-md shadow-lg p-3 min-w-[200px]">
          <div className="mb-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") onSave()
                if (e.key === "Escape") onCancel()
              }}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-${focusColor}-500 focus:ring-${focusColor}-500`}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white h-full max-md:p-0 rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Loading spinner in top right */}
      {isLoading && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-white px-3 py-2 rounded-md shadow-md border border-gray-200">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-sm text-gray-700 font-medium">
            Recalculating
          </span>
        </div>
      )}

      {/* Small input in top right */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex flex-wrap-reverse gap-2 items-center">
          {/* Selected model tags */}
          <div className="flex ml-auto flex-wrap justify-end gap-1 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex ml-auto items-center px-2 py-1 bg-gray-50 text-gray-700 text-xs font-medium rounded-full border border-gray-200 hover:bg-gray-100 transition-colors">
                  + Model
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                        disabled={selectedModels.includes(model)}
                        onClick={async () => {
                          setSettings((prev: Settings) => {
                            return {
                              ...prev,
                              selectedModels: [...prev.selectedModels, model],
                            }
                          })

                          // Fetch embeddings for pole words and regular words for the new model
                          await fetchEmbeddingsForNewModel(model)
                        }}
                      >
                        {model}
                      </DropdownMenuItem>
                    )
                  })}
                <DropdownMenuItem
                  className="text-gray-500 hover:text-gray-700 text-sm"
                  onClick={onShowSettings}
                >
                  + Add Model
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedModels.map((model) => {
              const service = MODELS.find(
                (modelData) => modelData.model === model
              )?.service
              const color = service ? modelColors[service] : undefined
              return (
                <button
                  key={model}
                  onMouseEnter={() => setHoveredModel(model)}
                  onMouseLeave={() => setHoveredModel(null)}
                  className={`inline-flex cursor-pointer items-center px-2 py-1 text-xs font-medium rounded-full border transition-all hover:opacity-75 ${(service && modelColors[service]) || "bg-gray-50 text-gray-700 border-gray-200"}`}
                >
                  {model}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleModelRemovalClick(model)
                    }}
                  >
                    <svg
                      className="ml-1 h-3 w-3"
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
          <div className="flex ml-auto flex-row flex-wrap gap-1 items-center">
            <input
              type="text"
              value={wordInput}
              onChange={(e) => onWordInputChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder="Enter a word"
              className="w-32 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={() => {
                if (!settings?.selectedModels?.length) {
                  toast.info("Add a model")
                  return
                }
                // Check if API keys exist for all selected models
                const missingKeys = settings.selectedModels.filter(modelName => {
                  const modelData = MODELS.find(m => m.model === modelName)
                  if (!modelData) return true
                  return !settings?.keys?.[modelData.service]
                })
                if (missingKeys.length > 0) {
                  toast.info("Please add API keys for selected models")
                  return
                }
                if (isLoading) {
                  toast.info("Please wait for the current request to finish")
                  return
                }
                if (wordInput.trim() === "") {
                  toast.info("Please enter a word")
                  return
                }
                if (words?.some((w: any) => w.word === wordInput.trim())) {
                  toast.info("Word already exists")
                  return
                }
                onAddWord()
              }}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2 cursor-pointer py-1.5 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="18" r="2" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={handleSaveClick}
                  disabled={isLoading || !words || words.length === 0}
                >
                  Save All
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onExportWords}
                  disabled={isLoading || !words || words.length === 0}
                >
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowClearConfirmation(true)}
                >
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      <Dialog
        open={showClearConfirmation}
        onOpenChange={setShowClearConfirmation}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Words</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all words from the axis?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={handleClearCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              onClick={handleClearConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Clear All
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Word List</DialogTitle>
            <DialogDescription>
              Enter a name for your word list or choose an existing one to
              replace:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleSaveConfirm()
                if (e.key === "Escape") handleSaveCancel()
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
              placeholder="Enter word list name"
              autoFocus
            />

            {/* Existing word lists */}
            {(() => {
              const savedLists = JSON.parse(
                localStorage.getItem("savedWordLists") || "[]"
              )
              if (!savedLists?.length) return null

              return (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Or replace existing list:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {savedLists.map((list: any) => (
                      <button
                        key={list.id}
                        onClick={() => {
                          setSelectedListId(list.id)
                          setSaveName(list.name)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedListId === list.id ?
                            "bg-blue-100 text-blue-800 border border-blue-300"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <button
              onClick={handleSaveCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 "
            >
              {selectedListId ? "Replace" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative h-full pt-6 px-6 overflow-y-auto overflow-x-hidden">
        {/* Main axis line */}
        <div className="absolute left-6 right-6 top-1/2 transform -translate-y-1/2 h-1 bg-gray-300 rounded-full"></div>

        {/* South Pole Label */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
          <div
            onClick={() => setShowPolePopup("left")}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm font-medium shadow-sm cursor-pointer hover:bg-red-200 transition-colors"
          >
            {poles.find((p) => p.pole === Pole.LEFT)?.word || ""}
          </div>

          {showPolePopup === "left" && (
            <PolePopup
              isOpen={true}
              value={tempPoles.find((p) => p.pole === Pole.LEFT)?.word || ""}
              onChange={(value) =>
                setTempPoles((prev) =>
                  prev.map((p) =>
                    p.pole === Pole.LEFT ? { ...p, word: value } : p
                  )
                )
              }
              onSave={handlePoleSave}
              onCancel={handlePoleCancel}
              placeholder="Enter south pole word"
              focusColor="red"
              position="left"
            />
          )}
        </div>

        {/* North Pole Label */}
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
          <div
            onClick={() => setShowPolePopup("right")}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm font-medium shadow-sm cursor-pointer hover:bg-green-200 transition-colors"
          >
            {poles.find((p) => p.pole === Pole.RIGHT)?.word || ""}
          </div>

          {showPolePopup === "right" && (
            <PolePopup
              isOpen={true}
              value={tempPoles.find((p) => p.pole === Pole.RIGHT)?.word || ""}
              onChange={(value) =>
                setTempPoles((prev) =>
                  prev.map((p) =>
                    p.pole === Pole.RIGHT ? { ...p, word: value } : p
                  )
                )
              }
              onSave={handlePoleSave}
              onCancel={handlePoleCancel}
              placeholder="Enter north pole word"
              focusColor="green"
              position="right"
            />
          )}
        </div>

        {/* Words positioned along the axis */}
        {positionedWords.map(({ wordData, position, verticalOffset }) => {
          // Find the corresponding word to get model info
          const wordInfo = words.find((w: any) => w.word === wordData.word)
          const modelService = MODELS.find(
            (m: any) => m.model === wordData.model
          )?.service

          const wordModelColors: Record<string, string> = {
            google: "bg-blue-100 text-blue-800 border-blue-300",
            openai: "bg-green-100 text-green-800 border-green-300",
            voyage: "bg-purple-100 text-purple-800 border-purple-300",
            mistral: "bg-orange-100 text-orange-800 border-orange-300",
            huggingface: "bg-yellow-100 text-yellow-800 border-yellow-300",
          }

          const colorClass =
            (modelService && wordModelColors[modelService]) ||
            "bg-gray-100 text-gray-800 border-gray-300"

          // Determine opacity based on hover state
          const isHovered = hoveredModel === wordData.model
          const shouldReduceOpacity = hoveredModel && !isHovered
          const opacityClass =
            shouldReduceOpacity ? "opacity-40" : "opacity-100"

          return (
            <div
              key={wordData.word + wordData.model}
              onClick={(e) => {
                e.stopPropagation()
                onRemoveWord(wordData.word)
              }}
              className={`absolute px-2 max-md:text-[10px] text-xs py-1 rounded-md font-medium shadow-sm transform -translate-x-1/2 -translate-y-1/2 cursor-pointer duration-200 z-20 border ${colorClass} ${opacityClass} hover:opacity-75`}
              style={{
                left: `${6 + (position / 100) * 88}%`,
                top: `calc(50% - 20px + ${verticalOffset}px)`,
              }}
            >
              {wordData.word}
            </div>
          )
        })}
      </div>

      {/* Model Removal Confirmation Dialog */}
      <Dialog
        open={showModelRemovalConfirmation}
        onOpenChange={setShowModelRemovalConfirmation}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {modelToRemove}? This will remove
              all words and embeddings for this model from the graph.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={handleModelRemovalCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleModelRemovalConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Remove Model
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
