import { Suspense } from "react";
import { WorkerChoice } from "@/components/WorkerChoice";

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-4 py-16 font-hand text-2xl">Opening your envelope…</main>}>
      <WorkerChoice />
    </Suspense>
  );
}
