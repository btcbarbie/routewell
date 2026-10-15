import { handle } from "@/lib/http";
import { checkLimit, clientIp } from "@/lib/limits";
import { processIntake } from "@/lib/payrun";
import { sheetToText } from "@/lib/sheets";
import { snapshot } from "@/lib/state";
import { workspaceId } from "@/lib/workspace";

const MAX_FILE = 8 * 1024 * 1024;

export async function POST(req: Request) {
  return handle(async () => {
    checkLimit("ai", clientIp(req));
    const ws = await workspaceId();
    const form = await req.formData();
    const text = String(form.get("text") ?? "").slice(0, 8000);
    const sheets: { fileName: string; text: string }[] = [];
    const receipts: { fileName: string; data: Buffer; mimeType: string; personId: string | null }[] = [];
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length > 10) throw new Error("Send up to 10 files at a time.");
    for (const file of files) {
      if (file.size > MAX_FILE) throw new Error(`${file.name} is larger than 8 MB.`);
      const data = Buffer.from(await file.arrayBuffer());
      if (file.type.startsWith("image/")) {
        const personId = form.get(`person:${file.name}`);
        receipts.push({ fileName: file.name, data, mimeType: file.type, personId: personId ? String(personId) : null });
      } else {
        sheets.push({ fileName: file.name, text: await sheetToText(file.name, data) });
      }
    }
    if (!text.trim() && !files.length) throw new Error("Add a message, a spreadsheet or a receipt first.");
    await processIntake(ws, { text, sheets, receipts });
    return snapshot(ws);
  });
}
