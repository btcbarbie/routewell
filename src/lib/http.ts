import { AiError } from "./ai";

/** Run a handler and turn thrown errors into a short JSON message for the screen. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    return Response.json(out ?? { ok: true });
  } catch (e) {
    const message = e instanceof AiError || e instanceof Error ? e.message : "Something went wrong.";
    console.error(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
