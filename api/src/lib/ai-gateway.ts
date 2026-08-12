/**
 * Provedor de IA — roteia para OpenAI ou Google Gemini usando as
 * credenciais configuradas em Admin → Provedor de IA. A chave em si vive
 * em variáveis de ambiente do backend; AISettings.apiKeySecretRef diz
 * qual variável usar (ex.: OPENAI_API_KEY, GEMINI_API_KEY).
 */
import { prisma } from "../prisma.js";

export type AIProviderName = "openai" | "gemini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ResolvedAIConfig = {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  temperature: number;
};

/**
 * Carrega a config global de IA (Admin). Lança erro claro se estiver
 * incompleta — o líder nunca vê provedor/modelo, só recebe a resposta.
 */
export async function loadAIConfig(): Promise<ResolvedAIConfig> {
  const s = await prisma.aISettings.findFirst({
    where: { scope: "global" },
    orderBy: { updatedAt: "desc" },
  });
  if (!s) throw new Error("Provedor de IA ainda não configurado pelo administrador.");

  const provider = s.provider as AIProviderName;
  if (provider !== "openai" && provider !== "gemini") {
    throw new Error(`Provedor de IA inválido: ${provider}`);
  }

  // Prioridade: 1) chave salva no banco (Admin → Provedor de IA)
  //             2) variável de ambiente (apiKeySecretRef) — fallback avançado
  const stored = s.apiKey?.trim();
  const envName =
    s.apiKeySecretRef?.trim() ||
    (provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY");
  const apiKey = stored || process.env[envName];
  if (!apiKey) {
    throw new Error(
      `Chave de API ausente. Configure em Admin → Provedor de IA (ou defina a variável ${envName} no backend).`,
    );
  }

  return { provider, model: s.model, apiKey, temperature: s.temperature };
}

// ---------- OpenAI ----------

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function openaiComplete(cfg: ResolvedAIConfig, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j.error?.message) msg = j.error.message;
    } catch { /* ignore */ }
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

async function* openaiStream(cfg: ResolvedAIConfig, messages: ChatMessage[]) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore */
      }
    }
  }
}

// ---------- Gemini ----------

type GeminiContent = { role: "user" | "model"; parts: Array<{ text: string }> };

function toGemini(messages: ChatMessage[]): { system?: string; contents: GeminiContent[] } {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

function geminiUrl(model: string, action: "generateContent" | "streamGenerateContent", key: string) {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${action}`;
  return action === "streamGenerateContent" ? `${base}?alt=sse&key=${key}` : `${base}?key=${key}`;
}

async function geminiComplete(cfg: ResolvedAIConfig, messages: ChatMessage[]): Promise<string> {
  const { system, contents } = toGemini(messages);
  const res = await fetch(geminiUrl(cfg.model, "generateContent", cfg.apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { role: "system", parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: cfg.temperature },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function* geminiStream(cfg: ResolvedAIConfig, messages: ChatMessage[]) {
  const { system, contents } = toGemini(messages);
  const res = await fetch(geminiUrl(cfg.model, "streamGenerateContent", cfg.apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { role: "system", parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: cfg.temperature },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const j = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const delta = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
        if (delta) yield delta;
      } catch {
        /* ignore */
      }
    }
  }
}

// ---------- API pública ----------

export async function completeChat({
  messages,
  temperature,
}: {
  messages: ChatMessage[];
  temperature?: number;
  /** ignorado — modelo/provedor vêm de AISettings global */
  model?: string;
}): Promise<string> {
  const cfg = await loadAIConfig();
  if (typeof temperature === "number") cfg.temperature = temperature;
  return cfg.provider === "openai" ? openaiComplete(cfg, messages) : geminiComplete(cfg, messages);
}

export async function* streamChat({
  messages,
  temperature,
}: {
  messages: ChatMessage[];
  temperature?: number;
  /** ignorado — modelo/provedor vêm de AISettings global */
  model?: string;
}): AsyncGenerator<string, void, unknown> {
  const cfg = await loadAIConfig();
  if (typeof temperature === "number") cfg.temperature = temperature;
  if (cfg.provider === "openai") {
    for await (const d of openaiStream(cfg, messages)) yield d;
  } else {
    for await (const d of geminiStream(cfg, messages)) yield d;
  }
}

// ---------- Transcrição de áudio (voz → texto) ----------

/**
 * Extrai o texto útil de um documento anexado (PDF, DOCX, imagem…).
 * Arquivos de texto puro são decodificados localmente; binários vão para o
 * provedor de IA configurado, que devolve o conteúdo em texto corrido.
 */
export async function extractDocumentText({
  filename,
  mimeType,
  base64,
}: {
  filename: string;
  mimeType: string;
  base64: string;
}): Promise<string> {
  const plain = /^text\//i.test(mimeType) || /\.(txt|md|csv|json)$/i.test(filename);
  if (plain) return Buffer.from(base64, "base64").toString("utf8").slice(0, 20000);

  const instruction =
    "Extraia em texto corrido, em português do Brasil, tudo o que este documento descreve sobre as atividades, responsabilidades e rotinas de trabalho da pessoa. Não invente nada. Responda apenas com o conteúdo extraído.";

  const cfg = await loadAIConfig();

  if (cfg.provider === "openai") {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              /^image\//i.test(mimeType)
                ? { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                : { type: "file", file: { filename, file_data: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return (json.choices?.[0]?.message?.content ?? "").slice(0, 20000);
  }

  const res = await fetch(geminiUrl(cfg.model, "generateContent", cfg.apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: instruction }, { inlineData: { mimeType, data: base64 } }] },
      ],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").slice(0, 20000);
}

/**
 * Transcreve áudio usando o provedor configurado.
 * - Gemini: envia como inlineData multimodal para o mesmo modelo de chat.
 * - OpenAI: usa /v1/audio/transcriptions com whisper-1.
 * Retorna somente o texto transcrito em pt-BR.
 */
export async function transcribeAudio({
  audioBase64,
  mimeType,
}: {
  audioBase64: string;
  mimeType: string;
}): Promise<string> {
  const cfg = await loadAIConfig();
  if (cfg.provider === "gemini") {
    const res = await fetch(geminiUrl(cfg.model, "generateContent", cfg.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: "Transcreva o áudio em português do Brasil. Responda somente com a transcrição, sem comentários." },
              { inlineData: { mimeType, data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
  }
  // OpenAI: whisper-1 via /v1/audio/transcriptions
  const buf = Buffer.from(audioBase64, "base64");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeType }), `audio.${mimeType.includes("mp4") ? "mp4" : "webm"}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcribe ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}