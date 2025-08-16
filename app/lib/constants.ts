enum Models {
  GEMINI = "gemini-embedding-001",
  TEXT_EMBEDDING_3_LARGE = "text-embedding-3-large",
  VOYAGE = "voyage-3-large",
  HUGGINGFACE = "Qwen/Qwen3-Embedding-8B",
  MISTRAL = "mistral-embed",
  OPENAI = "text-embedding-ada-002",
}

export enum Services {
  GOOGLE = "google",
  MISTRAL = "mistral",
  OPENAI = "openai",
  VOYAGE = "voyage",
  HUGGINGFACE = "huggingface",
}

export const MODELS = [
  {
    model: Models.GEMINI,
    service: Services.GOOGLE,
    label: "Google",
    key: "googleKey",
  },
  {
    model: Models.MISTRAL,
    service: Services.MISTRAL,
    label: "Mistral AI",
    key: "mistralKey",
  },
  {
    model: Models.OPENAI,
    service: Services.OPENAI,
    label: "OpenAI",
    key: "openaiKey",
  },
  {
    model: Models.VOYAGE,
    service: Services.VOYAGE,
    label: "Voyage AI",
    key: "voyageKey",
  },
  {
    model: Models.HUGGINGFACE,
    service: Services.HUGGINGFACE,
    label: "Hugging Face",
    key: "huggingFaceKey",
  },
]
