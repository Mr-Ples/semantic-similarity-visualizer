import { cosineSimilarity } from "./embeddings.utils"

export interface WordData {
  word: string;
  embedding: number[];
  model: string;
}

export interface WordPosition {
  word: string;
  southDistance: number;
  northDistance: number;
}

export function calculateWordPosition(
  wordData: WordData,
  southPoleEmbedding: number[],
  northPoleEmbedding: number[]
): WordPosition {
  const southDistance = cosineSimilarity(wordData.embedding, southPoleEmbedding);
  const northDistance = cosineSimilarity(wordData.embedding, northPoleEmbedding);
  
  return { 
    word: wordData.word, 
    southDistance, 
    northDistance 
  };
}

export function calculateAllWordPositions(
  words: WordData[],
  southPoleEmbedding: number[],
  northPoleEmbedding: number[]
): WordPosition[] {
  return words
    .filter(wordData => wordData.embedding && wordData.embedding.length > 0)
    .map(wordData => calculateWordPosition(wordData, southPoleEmbedding, northPoleEmbedding));
}
