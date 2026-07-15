import { createMiddleware } from "@tanstack/react-start";
import { getAccessToken } from "./client";

export const attachAuthToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getAccessToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
