import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Services, type EmbeddingModels } from "~/lib/constants"
import { getWordEmbedding } from "~/lib/embeddings.client"

export enum EmbeddingAction {
  GET_EMBEDDING = "getEmbedding",
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()
  switch (params.action) {
    case EmbeddingAction.GET_EMBEDDING:
      const input = {
        word: formData.get("word") as string,
        model: formData.get("model") as EmbeddingModels,
        key: formData.get("key") as string,
      }
      const data = await getWordEmbedding(input)
      return {
        success: !!data?.embedding,
        data: data,
        error: null,
        input: input
      }
    default:
      return { error: "invalid action" }
  }
}
