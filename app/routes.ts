import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/embeddings", "./routes/api.embeddings.ts")
] satisfies RouteConfig;
