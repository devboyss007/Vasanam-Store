import { StorageNotConnected } from "./store/none";

/** Wraps an admin route so a missing storage is explained, not a bare 500. */
export function guard<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof StorageNotConnected) {
        return Response.json({ error: e.message }, { status: 503 });
      }
      console.error("admin request failed", e);
      return Response.json({ error: "The server could not do that" }, { status: 500 });
    }
  };
}
