import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/embeddings/:action", "./routes/api.embeddings.$action.ts")
] satisfies RouteConfig;
