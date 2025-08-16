import type { WordData } from "./constants";

// Calculate dot product of two vectors
export const dotProduct = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  return vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
};

// Calculate magnitude (length) of a vector
export const magnitude = (vec: number[]): number => {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
};

// Calculate cosine similarity between two vectors
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  const dot = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  
  if (magA === 0 || magB === 0) {
    throw new Error('Cannot calculate cosine similarity for zero vector');
  }
  
  return dot / (magA * magB);
};

export interface WordPosition {
  wordData: WordData;
  southDistance: number;
  northDistance: number;
}

function calculateWordPosition(
  wordData: WordData,
  southPoleEmbedding: number[],
  northPoleEmbedding: number[]
): WordPosition {
  const southDistance = cosineSimilarity(wordData.embedding, southPoleEmbedding);
  const northDistance = cosineSimilarity(wordData.embedding, northPoleEmbedding);
  
  return { 
    wordData, 
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
