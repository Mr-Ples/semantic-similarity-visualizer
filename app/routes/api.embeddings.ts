import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { json } from "react-router"
import {
  computeWordPositionWithSettings,
  type EmbeddingSettings,
  type WordData,
} from "~/lib/embeddings.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const word = url.searchParams.get("word")
  const model =
    url.searchParams.get("model") || "nomic-ai/nomic-embed-text-v1.5"
  const openaiKey = url.searchParams.get("openaiKey") || ""
  const voyageKey = url.searchParams.get("voyageKey") || ""
  const googleKey = url.searchParams.get("googleKey") || ""
  const northPole = url.searchParams.get("northPole") || "good"
  const southPole = url.searchParams.get("southPole") || "evil"

  if (!word) {
    return { error: "Word parameter is required" }
  }

  try {
    const settings: EmbeddingSettings = {
      model,
      openaiKey,
      voyageKey,
      googleKey,
      northPole,
      southPole,
    }

    const wordData = await computeWordPositionWithSettings(word, settings)
    return wordData
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "addWord") {
    const word = formData.get("word") as string
    const model =
      (formData.get("model") as string) || "nomic-ai/nomic-embed-text-v1.5"
    const openaiKey = (formData.get("openaiKey") as string) || ""
    const voyageKey = (formData.get("voyageKey") as string) || ""
    const googleKey = (formData.get("googleKey") as string) || ""
    const northPole = (formData.get("northPole") as string) || "good"
    const southPole = (formData.get("southPole") as string) || "evil"

    if (!word) {
      return { error: "Word is required" }
    }

    try {
      const settings: EmbeddingSettings = {
        model,
        openaiKey,
        voyageKey,
        googleKey,
        northPole,
        southPole,
      }

      const wordData = await computeWordPositionWithSettings(word, settings)
      return wordData
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  if (intent === "computeMultiple") {
    const words = formData.get("words") as string
    const model =
      (formData.get("model") as string) || "nomic-ai/nomic-embed-text-v1.5"
    const openaiKey = (formData.get("openaiKey") as string) || ""
    const voyageKey = (formData.get("voyageKey") as string) || ""
    const googleKey = (formData.get("googleKey") as string) || ""
    const northPole = (formData.get("northPole") as string) || "good"
    const southPole = (formData.get("southPole") as string) || "evil"

    if (!words) {
      return { error: "Words are required" }
    }

    try {
      const wordList = JSON.parse(words) as string[]
      const settings: EmbeddingSettings = {
        model,
        openaiKey,
        voyageKey,
        googleKey,
        northPole,
        southPole,
      }

      const wordDataList: WordData[] = []
      for (const word of wordList) {
        const wordData = await computeWordPositionWithSettings(word, settings)
        wordDataList.push(wordData)
      }

      return wordDataList
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  return { error: "Invalid intent" }
}
