export enum EmbeddingModels {
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
    model: EmbeddingModels.GEMINI,
    service: Services.GOOGLE,
    label: "Google",
    key: "googleKey",
  },
  {
    model: EmbeddingModels.MISTRAL,
    service: Services.MISTRAL,
    label: "Mistral AI",
    key: "mistralKey",
  },
  {
    model: EmbeddingModels.OPENAI,
    service: Services.OPENAI,
    label: "OpenAI",
    key: "openaiKey",
  },
  {
    model: EmbeddingModels.VOYAGE,
    service: Services.VOYAGE,
    label: "Voyage AI",
    key: "voyageKey",
  },
  {
    model: EmbeddingModels.HUGGINGFACE,
    service: Services.HUGGINGFACE,
    label: "Hugging Face",
    key: "huggingFaceKey",
  },
]

type KeyObject = {
  key: string
  service: Services
}

export interface Settings {
  selectedModels: string[]
  keys: {
    [key in Services]?: string
  }
  enableVerticalAxis?: boolean
}

export enum Pole {
  TOP = "top",
  BOTTOM = "bottom",
  LEFT = "left",
  RIGHT = "right",
}

export interface PoleWordData {
  word: string;
  embeddings?:{
    [key in EmbeddingModels]?: number[];
  };
  pole: Pole;
}


export interface WordData {
  word: string;
  embedding?: number[];
  model: EmbeddingModels;
}

export const modelColors: Record<Services, string> = {
  [Services.GOOGLE]: "blue",
  [Services.OPENAI]: "green",
  [Services.VOYAGE]: "purple",
  [Services.MISTRAL]: "orange",
  [Services.HUGGINGFACE]: "yellow",
}
