import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { Buffer } from "node:buffer";

const router = Router();

router.post("/tutor/transcribe", async (req, res) => {
  const { audioBase64, mimeType } = req.body;

  if (!audioBase64) {
    res.status(400).json({ error: "audioBase64 required" });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const ext = mimeType?.includes("mp4") ? "mp4" : mimeType?.includes("wav") ? "wav" : "m4a";
    const contentType = (mimeType as string | undefined) ?? "audio/m4a";

    const audioBlob = new Blob([audioBuffer], { type: contentType });
    const audioFile = new File([audioBlob], `recording.${ext}`, { type: contentType });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    res.json({ text: transcription.text });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Transcription failed";
    res.status(500).json({ error: errMsg });
  }
});

export default router;
