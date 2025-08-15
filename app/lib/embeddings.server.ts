import { cosineSimilarity, computeWordPosition, type WordData } from "./embeddings.utils";

export interface EmbeddingSettings {
  model: string;
  openaiKey: string;
  voyageKey: string;
  googleKey: string;
  northPole: string;
  southPole: string;
}

export async function embedWord(word: string, settings: EmbeddingSettings): Promise<number[]> {
  const { openaiKey, voyageKey, googleKey, model } = settings;
  
  if (openaiKey === "" && voyageKey === "" && googleKey === "") {
    // Use Hugging Face model (this would need to be implemented with a proper HF client)
    throw new Error("Hugging Face embeddings not implemented in server context. Please add an OpenAI, Voyage, or Google API key in the settings.");
  }

  if (googleKey !== "") {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'content': {
          'parts': [{
            'text': word
          }]
        },
        'task_type': 'SEMANTIC_SIMILARITY'
      })
    });

    const data = await response.json();
    return data.embedding.values;
  }

  if (voyageKey !== "") {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + voyageKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'input': word,
        'model': 'voyage-3-large',
        'input_type': 'document'
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  if (openaiKey !== "") {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + openaiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'input': word,
        'model': 'text-embedding-3-large',
        'encoding_format': 'float'
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  throw new Error('No valid API key provided. Please add an OpenAI, Voyage, or Google API key in the settings.');
}

export async function computeWordPositionWithSettings(word: string, settings: EmbeddingSettings): Promise<WordData> {
  return computeWordPosition(word, (word) => embedWord(word, settings), settings.southPole, settings.northPole);
}
