import type { AppLoadContext } from "react-router"
import { type WordData } from "./embeddings.utils"

export interface EmbeddingSettings {
  model: string
  openaiKey: string
  voyageKey: string
  googleKey: string
  huggingFaceKey: string
  mistralKey: string
  northPole: string
  southPole: string
}

export async function embedWord(
  word: string,
  settings: EmbeddingSettings,
  context: AppLoadContext
): Promise<{ embedding: number[]; model: string }> {
  const { model, openaiKey, voyageKey, googleKey, huggingFaceKey, mistralKey } =
    settings

  // Use the selected service to determine which API to use
  if (model === "google" && googleKey !== "") {
    // const key = googleKey || context.cloudflare.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "content": {
            "parts": [
              {
                "text": word,
              },
            ],
          },
          "task_type": "SEMANTIC_SIMILARITY",
        }),
      }
    )

    const data = await response.json()
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    return { embedding: data.embedding.values, model: "gemini-embedding-001" }
  }

  if (model === "voyage" && voyageKey !== "") {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + voyageKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "input": word,
        "model": "voyage-3-large",
        "input_type": "document",
      }),
    })

    const data = await response.json()
    console.log(data)
    if (!data.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.data[0].embedding, model: "voyage-3-large" }
  }

  if (model === "openai" && openaiKey !== "") {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openaiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "input": word,
        "model": "text-embedding-3-large",
        "encoding_format": "float",
      }),
    })

    const data = await response.json()
    // console.log(data)
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    return { embedding: data.data[0].embedding, model: "text-embedding-3-large" }
  }

  if (model === "mistral" && mistralKey !== "" ) {
    const key = mistralKey
    const response = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "mistral-embed",
        "input": word,
      }),
    })

    const data = await response.json()
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (!data?.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data?.data?.[0]?.embedding, model: "mistral-embed" }
  }

  if (model === "huggingface" && huggingFaceKey !== "") {
    const response = await fetch(
      "https://router.huggingface.co/nebius/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + huggingFaceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "input": word,
          "model": "Qwen/Qwen3-Embedding-8B",
        }),
      }
    )

    const data = await response.json()

    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (data?.detail) {
      throw new Error(JSON.stringify(data.detail))
    }
    if (!data.data[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.data[0]?.embedding, model: "Qwen/Qwen3-Embedding-8B" }
  }

  throw new Error(
    `No valid API key provided for ${model}. Please add the appropriate API key in the settings.`
  )
}

export async function getWordEmbedding(
  word: string,
  settings: EmbeddingSettings,
  context: AppLoadContext
): Promise<WordData> {
  const result = await embedWord(word, settings, context)
  if (!Array.isArray(result.embedding)) {
    throw new Error("Embedding must be an array")
  }
  return { word, embedding: result.embedding, model: result.model }
}
