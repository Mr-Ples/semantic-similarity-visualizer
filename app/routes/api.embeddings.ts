import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Services } from "~/lib/constants"
import {
  getWordEmbedding,
  type EmbeddingSettings,
} from "~/lib/embeddings.server"
import type { WordData } from "~/lib/embeddings.utils"

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const word = url.searchParams.get("word")
  const selectedService = url.searchParams.get("selectedService") || Services.GOOGLE
  const openaiKey = url.searchParams.get("openaiKey") || ""
  const voyageKey = url.searchParams.get("voyageKey") || ""
  const googleKey = url.searchParams.get("googleKey") || ""
  const huggingFaceKey = url.searchParams.get("huggingFaceKey") || ""
  const mistralKey = url.searchParams.get("mistralKey") || ""

  if (!word) {
    return { error: "Word parameter is required" }
  }

  try {
    const settings: EmbeddingSettings = {
      model: selectedService,
      openaiKey,
      voyageKey,
      googleKey,
      huggingFaceKey,
      mistralKey,
      northPole: "",
      southPole: "",
    }

    const wordData = await getWordEmbedding(word, settings, context)
    return wordData
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "addWord") {
    const word = formData.get("word") as string
    const selectedService =
      (formData.get("selectedService") as string) || "mistral"
    const openaiKey = (formData.get("openaiKey") as string) || ""
    const voyageKey = (formData.get("voyageKey") as string) || ""
    const googleKey = (formData.get("googleKey") as string) || ""
    const huggingFaceKey = (formData.get("huggingFaceKey") as string) || ""
    const mistralKey = (formData.get("mistralKey") as string) || ""

    if (!word) {
      return { error: "Word is required" }
    }

    try {
      const settings: EmbeddingSettings = {
        model: selectedService,
        openaiKey,
        voyageKey,
        googleKey,
        huggingFaceKey,
        mistralKey,
        northPole: "",
        southPole: "",
      }

      const wordData = await getWordEmbedding(word, settings, context)
      return wordData
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  if (intent === "computeMultiple") {
    const words = formData.get("words") as string
    const selectedService =
      (formData.get("selectedService") as string) || "mistral"
    const openaiKey = (formData.get("openaiKey") as string) || ""
    const voyageKey = (formData.get("voyageKey") as string) || ""
    const googleKey = (formData.get("googleKey") as string) || ""
    const huggingFaceKey = (formData.get("huggingFaceKey") as string) || ""
    const mistralKey = (formData.get("mistralKey") as string) || ""

    if (!words) {
      return { error: "Words are required" }
    }

    try {
      const wordList = JSON.parse(words) as string[]
      const settings: EmbeddingSettings = {
        model: selectedService,
        openaiKey,
        voyageKey,
        googleKey,
        huggingFaceKey,
        mistralKey,
        northPole: "",
        southPole: "",
      }

      const wordDataList: WordData[] = []
      for (const word of wordList) {
        const wordData = await getWordEmbedding(word, settings, context)
        wordDataList.push(wordData)
      }

      return wordDataList
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  return { error: "Invalid intent" }
}
