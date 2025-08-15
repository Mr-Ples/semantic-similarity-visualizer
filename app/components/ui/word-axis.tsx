import { useState, useEffect, useRef, useMemo } from "react"
import type { WordData } from "~/lib/embeddings.utils"

interface WordAxisProps {
  words: WordData[]
  northPole: string
  southPole: string
  onRemoveWord: (word: string) => void
  onEditNorthPole: (value: string) => void
  onEditSouthPole: (value: string) => void
  wordInput: string
  onWordInputChange: (value: string) => void
  onAddWord: () => void
  onClearAll: () => void
  isLoading: boolean
  onKeyPress: (e: React.KeyboardEvent) => void
}

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
  northPole,
  southPole,
  onRemoveWord,
  onEditNorthPole,
  onEditSouthPole,
  wordInput,
  onWordInputChange,
  onAddWord,
  onClearAll,
  isLoading,
  onKeyPress,
}: WordAxisProps) {
  const [showNorthPolePopup, setShowNorthPolePopup] = useState(false)
  const [showSouthPolePopup, setShowSouthPolePopup] = useState(false)
  const [tempNorthPole, setTempNorthPole] = useState(northPole)
  const [tempSouthPole, setTempSouthPole] = useState(southPole)

  useEffect(() => {
    setTempNorthPole(northPole)
    setTempSouthPole(southPole)
  }, [northPole, southPole])

  const handleNorthPoleSave = () => {
    onEditNorthPole(tempNorthPole)
    setShowNorthPolePopup(false)
  }

  const handleSouthPoleSave = () => {
    onEditSouthPole(tempSouthPole)
    setShowSouthPolePopup(false)
  }

  const handleNorthPoleCancel = () => {
    setTempNorthPole(northPole)
    setShowNorthPolePopup(false)
  }

  const handleSouthPoleCancel = () => {
    setTempSouthPole(southPole)
    setShowSouthPolePopup(false)
  }

  // Calculate positions for visualization
  const positionedWords = useMemo(() => {
    if (!words || words.length === 0) return []

    const positions = words.map(
      (d) => d.northDistance / (d.southDistance + d.northDistance)
    )
    const minPos = Math.min(...positions)
    const maxPos = Math.max(...positions)

    const wordPositions = words.map((wordData) => {
      const rawPosition =
        wordData.northDistance /
        (wordData.southDistance + wordData.northDistance)
      const normalizedPosition =
        ((rawPosition - minPos) / (maxPos - minPos)) * 100

      return {
        word: wordData.word,
        northDistance: wordData.northDistance,
        southDistance: wordData.southDistance,
        position: normalizedPosition,
        verticalOffset: 0,
      }
    })

    // Sort by position to check for overlaps
    wordPositions.sort((a, b) => a.position - b.position)

    // Group overlapping words and assign vertical positions
    const overlapGroups = []
    
    for (let i = 0; i < wordPositions.length; i++) {
      const currentWord = wordPositions[i]
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
            const offset = i % 2 === 1 ? -(Math.floor(i / 2) + 1) * 40 : (Math.floor(i / 2) + 1) * 40
            group[i].verticalOffset = offset
          }
        }
      }
    }

    return wordPositions
  }, [words])

  function PolePopup({ isOpen, value, onChange, onSave, onCancel, placeholder, focusColor, position }: PolePopupProps) {
    const popupRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
          onCancel()
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, onCancel])

    if (!isOpen) return null

    return (
      <div className={`absolute top-full ${position === 'left' ? 'left-0' : 'right-0'} mt-2 z-50`} ref={popupRef}>
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
    <div className="bg-white h-full rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Small input in top right */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={(e) => onWordInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Enter a word"
            className="w-32 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={onAddWord}
            disabled={isLoading}
            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
          <button
            onClick={onClearAll}
            className="px-3 py-1 bg-white text-gray-700 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="relative h-full pt-6 px-6 overflow-y-auto overflow-x-hidden">
        {/* Main axis line */}
        <div className="absolute left-6 right-6 top-1/2 transform -translate-y-1/2 h-1 bg-gray-300 rounded-full"></div>

        {/* South Pole */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
          <div
            onClick={() => setShowSouthPolePopup(true)}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm font-medium shadow-sm cursor-pointer hover:bg-red-200 transition-colors"
          >
            {southPole}
          </div>

          <PolePopup
            isOpen={showSouthPolePopup}
            value={tempSouthPole}
            onChange={setTempSouthPole}
            onSave={handleSouthPoleSave}
            onCancel={handleSouthPoleCancel}
            placeholder="Enter south pole word"
            focusColor="red"
            position="left"
          />
        </div>

        {/* North Pole */}
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
          <div
            onClick={() => setShowNorthPolePopup(true)}
            className="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm font-medium shadow-sm cursor-pointer hover:bg-green-200 transition-colors"
          >
            {northPole}
          </div>

          <PolePopup
            isOpen={showNorthPolePopup}
            value={tempNorthPole}
            onChange={setTempNorthPole}
            onSave={handleNorthPoleSave}
            onCancel={handleNorthPoleCancel}
            placeholder="Enter north pole word"
            focusColor="green"
            position="right"
          />
        </div>

        {/* Words positioned along the axis */}
        {positionedWords.map((wordData) => (
          <div
            key={wordData.word}
            onClick={(e) => {
              e.stopPropagation()
              onRemoveWord(wordData.word)
            }}
            className="absolute px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm font-medium shadow-sm transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-colors duration-200 z-20"
            style={{
              left: `${6 + (wordData.position / 100) * 88}%`,
              top: `calc(50% - 20px + ${wordData.verticalOffset}px)`,
            }}
          >
            {wordData.word}
          </div>
        ))}
      </div>
    </div>
  )
}
