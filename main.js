const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TRANSLATION_PROMPT = "You are a professional translation engine. Translate faithfully, preserve formatting, and return only the translated text.";
const DEFAULT_OCR_PROMPT = "You are a precise OCR engine. Extract visible text from images, preserve reading order and line breaks, and return only the recognized text.";
const DEFAULT_TTS_INSTRUCTIONS = "Speak clearly and naturally. Preserve the language and meaning of the input text.";

function stringValue(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampedNumberValue(value, fallback, min, max) {
  return Math.min(max, Math.max(min, numberValue(value, fallback)));
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function apiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function chatCompletionsUrl(baseUrl) {
  return apiUrl(baseUrl, "/chat/completions");
}

function speechUrl(baseUrl) {
  return apiUrl(baseUrl, "/audio/speech");
}

function sourceLanguage(from, options) {
  const detected = stringValue(options?.detect);
  const source = stringValue(from);
  if (source && source !== "auto") return source;
  if (detected && detected !== "auto") return detected;
  return "the source language";
}

function requestedOcrLanguage(language) {
  const value = stringValue(language);
  return value && value !== "auto" ? value : "the image's original language";
}

function commonPayload(config, defaultPrompt) {
  return {
    model: stringValue(config.model, DEFAULT_CHAT_MODEL),
    temperature: numberValue(config.temperature, 0.2),
    max_tokens: Math.max(1, Math.trunc(numberValue(config.maxTokens, 2048))),
    stream: booleanValue(config.stream, true),
    messages: [
      {
        role: "system",
        content: stringValue(config.systemPrompt, defaultPrompt),
      },
    ],
  };
}

function translationUserPrompt(text, from, to, options) {
  return [
    `Translate from ${sourceLanguage(from, options)} to ${stringValue(to, "the target language")}.`,
    "Return only the translated text. Do not add explanations, quotes, or markdown fences.",
    "",
    text,
  ].join("\n");
}

function translationPayload(text, from, to, options) {
  const config = options.config || {};
  const payload = commonPayload(config, DEFAULT_TRANSLATION_PROMPT);
  payload.messages.push({
    role: "user",
    content: translationUserPrompt(text, from, to, options),
  });
  return payload;
}

function ocrPayload(base64, language, options) {
  const config = options.config || {};
  const payload = commonPayload(config, DEFAULT_OCR_PROMPT);
  payload.max_tokens = Math.max(1, Math.trunc(numberValue(config.maxTokens, 4096)));
  payload.messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: [
          `Extract all visible text from this image. The expected language is ${requestedOcrLanguage(language)}.`,
          "Preserve reading order, paragraphs, and line breaks as much as possible.",
          "Return only the recognized text. If there is no visible text, return an empty string.",
        ].join("\n"),
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: stringValue(config.imageDetail, "auto"),
        },
      },
    ],
  });
  return payload;
}

function speechVoice(value) {
  const voice = stringValue(value, "marin");

  if (voice.startsWith("{")) {
    try {
      const parsed = JSON.parse(voice);
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        return { id: parsed.id.trim() };
      }
    } catch (_) {
      return voice;
    }
  }

  if (voice.startsWith("voice_")) {
    return { id: voice };
  }

  return voice;
}

function ttsPayload(text, language, options) {
  const config = options.config || {};
  const payload = {
    model: stringValue(config.model, DEFAULT_TTS_MODEL),
    input: text,
    voice: speechVoice(config.voice),
    response_format: stringValue(config.responseFormat, "mp3"),
    speed: clampedNumberValue(config.speed, 1, 0.25, 4.0),
  };

  const instructions = stringValue(config.instructions, DEFAULT_TTS_INSTRUCTIONS);
  if (instructions) {
    payload.instructions = instructions;
  }

  const normalizedLanguage = stringValue(language);
  if (normalizedLanguage && normalizedLanguage !== "auto" && payload.voice && typeof payload.voice === "object") {
    payload.language = normalizedLanguage;
  }

  return payload;
}

function responseMessage(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : part?.text || "")
      .join("")
      .trim();
  }

  return "";
}

async function readErrorResponse(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || JSON.stringify(payload);
  } catch (_) {
    return await response.text();
  }
}

async function readWithoutStreaming(response, { allowEmpty = false } = {}) {
  const payload = await response.json();
  const text = responseMessage(payload);
  if (!allowEmpty && !text) {
    throw new Error(`OpenAI-compatible response did not include text: ${JSON.stringify(payload)}`);
  }
  return text;
}

async function readWithStreaming(response, options, { allowEmpty = false } = {}) {
  if (!response.body?.getReader) {
    return await readWithoutStreaming(response, { allowEmpty });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        let payload;
        try {
          payload = JSON.parse(data);
        } catch (_) {
          continue;
        }

        const delta = payload?.choices?.[0]?.delta?.content || "";
        if (delta) {
          result += delta;
          options.setResult?.(delta);
        }
      }
    }
  }

  const text = result.trim();
  if (!allowEmpty && !text) {
    throw new Error("OpenAI-compatible stream did not include text.");
  }
  return text;
}

async function postJson(url, payload, options) {
  const config = options.config || {};
  const apiKey = stringValue(config.apiKey);
  if (!apiKey) {
    throw new Error("API key is required.");
  }

  const response = await options.utils.fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await readErrorResponse(response)}`);
  }

  return response;
}

async function postChatCompletion(payload, options) {
  const config = options.config || {};
  return await postJson(chatCompletionsUrl(stringValue(config.baseUrl, DEFAULT_BASE_URL)), payload, options);
}

async function postSpeech(payload, options) {
  const config = options.config || {};
  return await postJson(speechUrl(stringValue(config.baseUrl, DEFAULT_BASE_URL)), payload, options);
}

async function readChatCompletion(response, payload, options, readOptions) {
  return payload.stream
    ? await readWithStreaming(response, options, readOptions)
    : await readWithoutStreaming(response, readOptions);
}

export async function translate(text, from, to, options) {
  const payload = translationPayload(text, from, to, options);
  const response = await postChatCompletion(payload, options);
  return await readChatCompletion(response, payload, options, { allowEmpty: false });
}

export async function recognize(base64, language, options) {
  if (!stringValue(base64)) {
    throw new Error("Image content is required.");
  }

  const payload = ocrPayload(base64, language, options);
  const response = await postChatCompletion(payload, options);
  return await readChatCompletion(response, payload, options, { allowEmpty: true });
}

export async function tts(text, language, options) {
  if (!stringValue(text)) {
    throw new Error("Text content is required.");
  }

  const payload = ttsPayload(text, language, options);
  const response = await postSpeech(payload, options);
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length === 0) {
    throw new Error("OpenAI speech response did not include audio data.");
  }

  return {
    bytes,
    format: payload.response_format,
  };
}
