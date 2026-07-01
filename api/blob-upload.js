// Vercel serverless function: receives an image (raw body) and stores it in
// Vercel Blob, returning a public URL. The tool's "Export Code" action POSTs the
// dropped gradient/mask here so the embed can reference hosted URLs.
//
// Deploy notes:
// - Requires a Vercel Blob store linked to this project, which sets the
//   BLOB_READ_WRITE_TOKEN env var automatically (`vercel blob store add`).
// - Bodies are capped at Vercel's ~4.5MB serverless limit; the hero gradient/mask
//   are well under that. For larger assets switch to @vercel/blob client uploads.
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  // CORS: the tool may run on a different origin than this API.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      res.status(400).json({ error: "empty body" });
      return;
    }

    const filename = String(req.headers["x-filename"] || "hero-asset");
    const contentType = String(req.headers["content-type"] || "application/octet-stream");

    const { url } = await put(filename, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
}
