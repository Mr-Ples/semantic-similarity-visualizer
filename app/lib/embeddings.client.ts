import { EmbeddingModels, MODELS, Services } from "./constants"

export async function getWordEmbedding({
  word,
  model,
  key,
}: {
  word: string
  model: EmbeddingModels
  key: string
}): Promise<{ embedding: number[]; model: string }> {
  const service = MODELS.find((modelData) => modelData.model === model)?.service
  if (!service) {
    throw new Error(`No valid model for ${service}`)
  }

  // Use the selected service to determine which API to use
  if (service === Services.GOOGLE) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
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

    const data = (await response.json()) as {
      error?: string
      embedding?: { values: number[] }
    }
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (!data?.embedding?.values) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.embedding.values, model: model }
  }

  // TODO test
  if (service === Services.VOYAGE) {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "input": word,
        "model": MODELS.find((model) => model.service === service)?.model,
        "input_type": "document",
      }),
    })

    const data = (await response.json()) as {
      error?: string
      data?: { embedding: number[] }[]
    }
    console.log(data)
    if (!data.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.data[0].embedding, model: model }
  }

  // TODO test
  if (service === Services.OPENAI) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "input": word,
        "model": MODELS.find((model) => model.service === service)?.model,
        "encoding_format": "float",
      }),
    })

    const data = (await response.json()) as {
      error?: string
      data?: { embedding: number[] }[]
    }
    // console.log(data)
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (!data?.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.data[0].embedding, model: model }
  }

  if (service === Services.MISTRAL) {
    const response = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": MODELS.find((model) => model.service === service)?.model,
        "input": word,
      }),
    })

    const data = (await response.json()) as {
      error?: string
      data?: { embedding: number[] }[]
    }
    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (!data?.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data?.data?.[0]?.embedding, model: model }
  }

  if (service === Services.HUGGINGFACE) {
    const response = await fetch(
      "https://router.huggingface.co/nebius/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "input": word,
          "model": MODELS.find((model) => model.service === service)?.model,
        }),
      }
    )

    const data = (await response.json()) as {
      error?: string
      detail?: string
      data?: { embedding: number[] }[]
    }

    if (data?.error) {
      throw new Error(JSON.stringify(data.error))
    }
    if (data?.detail) {
      throw new Error(JSON.stringify(data.detail))
    }
    if (!data.data?.[0]?.embedding) {
      throw new Error(JSON.stringify(data))
    }
    return { embedding: data.data[0]?.embedding, model: model }
  }

  throw new Error(
    `No valid API key provided for ${model}. Please add the appropriate API key in the settings.`
  )
}
