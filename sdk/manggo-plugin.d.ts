/**
 * Manggo native plugin API v1 (manggo.plugin.v1).
 * These are development-only types; publish JavaScript and use type-only imports.
 * Web APIs such as fetch use the TypeScript DOM library. Bob and Pot have their
 * own compatibility contracts; their extra APIs are not native PluginUtils.
 */
export type MaybePromise<T> = T | Promise<T>;
export type PluginConfig = Record<string, unknown>;
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

/** Shared native utilities. setResult is the same callback as options.setResult. */
export interface PluginUtils<StreamResult = string> {
  /** Uses the application's network settings. */
  fetch: typeof globalThis.fetch;
  /** UTF-8 text; a leading UTF-8 BOM is removed. Relative paths use pluginDir. */
  readTextFile(path: string): Promise<string>;
  /** Native plugins receive a plain byte array (not Pot's Uint8Array). */
  readBinaryFile(path: string): Promise<number[]>;
  /** Virtual read-only package root: /package. */
  readonly pluginDir: string;
  /** Virtual plugin-private persistent data root: /data. */
  readonly cacheDir: string;
  readonly osType: "Darwin" | "Linux" | "Windows_NT";
  setResult(value: StreamResult): void;
}

export interface PluginOptions<StreamResult = string, Config extends object = PluginConfig> {
  /** Saved configuration with manifest defaults. Use your plugin's declared keys. */
  config: Config;
  /** Mapped detected source language, falling back to from; empty for other kinds. */
  detect: string;
  utils: PluginUtils<StreamResult>;
  setResult(value: StreamResult): void;
}

export interface DictionaryPronunciation {
  label?: string;
  /** At least one of phonetic and audioUrl must be nonempty. */
  phonetic?: string;
  audioUrl?: string;
}

/** At least one field must contain a nonempty value. */
export interface DictionaryMeaning {
  partOfSpeech?: string;
  translations?: string[];
  definitions?: string[];
  extendedDefinitions?: string[];
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  tags?: string[];
}

export interface DictionaryForm {
  type?: string;
  word: string;
}

export interface DictionaryProperty {
  key?: string;
  label?: string;
  value: string;
}

export interface DictionaryEntry {
  word: string;
  language?: string;
  pronunciations?: DictionaryPronunciation[];
  meanings?: DictionaryMeaning[];
  tags?: string[];
  forms?: DictionaryForm[];
  properties?: DictionaryProperty[];
  audioUrl?: string;
}

export interface DictionaryResult {
  kind: "dictionary";
  /**
   * Omitted/blank word defaults to the trimmed input text. Omitted/blank language
   * defaults to the detected source language, or the source when it is not auto.
   * Unknown fields and null values are rejected throughout the dictionary.
   */
  dictionary: Omit<DictionaryEntry, "word"> & { word?: string };
}

export type TranslationResult = string | DictionaryResult;

/** setResult appends text deltas. Return structured dictionaries directly. */
export type TranslationOptions<Config extends object = PluginConfig> = PluginOptions<string, Config>;

/**
 * Text deltas take precedence over a returned string when any text was emitted.
 * A returned dictionary takes precedence and requires resultType: "dictionary"
 * in the service manifest. With no return value, emitted text is the result.
 */
export type Translate<Config extends object = PluginConfig> = (
  text: string,
  /** Source code after applying the service's manifest language map. */
  from: string,
  /** Target code after applying the service's manifest language map. */
  to: string,
  options: TranslationOptions<Config>,
) => MaybePromise<TranslationResult | void>;

/** Coordinates refer to the unchanged input image. */
export interface OCRPoint {
  x: number;
  y: number;
}

export interface OCRTextRegion {
  text: string;
  /** Convex polygon vertices. Four corners are recommended. */
  polygon: OCRPoint[];
  /** Confidence supplied by the recognizer; omitted means unknown. */
  confidence?: number;
}

export interface OCRResult {
  /** Full recognized text. If omitted, region text is joined in array order. */
  text?: string;
  textRegions?: OCRTextRegion[];
  /** Default: normalized [0,1], origin top-left, x right, y down. */
  coordinateSystem?: "normalized" | "pixels";
}

/**
 * Strings append text deltas. Objects save the latest complete OCR snapshot,
 * used when the entry returns undefined. A returned object replaces text deltas;
 * a returned string is used only when no text deltas were emitted.
 */
export interface OCROptions<Config extends object = PluginConfig> extends PluginOptions<string | OCRResult, Config> {
  readonly image: { readonly pixelWidth: number; readonly pixelHeight: number };
}

export type Recognize<Config extends object = PluginConfig> = (
  /** PNG image bytes encoded as base64 without a data URI prefix. */
  base64: string,
  /** Code after applying the service's manifest language map. */
  language: string,
  options: OCROptions<Config>,
) => MaybePromise<string | OCRResult | void>;

export interface AudioFormat {
  /** Format hints are checked in this order, then service configuration is used. */
  format?: string;
  audioFormat?: string;
  responseFormat?: string;
  mimeType?: string;
  contentType?: string;
}

/** Legacy numeric-key byte object; keys must be contiguous starting at zero. */
export interface IndexedAudioBytes {
  [index: number]: number;
}

/** Bytes must be integers in [0,255]. Buffer is supported as a Uint8Array. */
export type AudioBytes = Uint8Array | ArrayBuffer | number[] | IndexedAudioBytes;

/** Nested audio fields are tried in order: base64, data, audio, bytes. */
export interface AudioResult<Data = AudioData> extends AudioFormat {
  base64?: Data;
  data?: Data;
  audio?: Data;
  bytes?: Data;
}

/** Strings contain Base64 or an audio Data URI. Fetch URLs before returning. */
export type AudioData = string | AudioBytes | AudioResult;

/** Blob, Response and Bun.file values can be returned through arrayBuffer(). */
export interface AudioSource {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type SpeechResult = AudioData | AudioSource;

/**
 * setResult serializes candidates as JSON; ArrayBuffer and Blob/Response are
 * supported only as direct return values. Candidates are complete audio, not
 * fragments: the latest nonempty candidate is used if the entry returns undefined.
 */
export type SpeechCandidate = string | Uint8Array | number[] | IndexedAudioBytes | AudioResult<SpeechCandidate>;
export type SpeechOptions<Config extends object = PluginConfig> = PluginOptions<SpeechCandidate, Config>;

/** An explicit return value takes precedence over candidates sent to setResult. */
export type Speak<Config extends object = PluginConfig> = (
  text: string,
  /** Code after applying the service's manifest language map. */
  language: string,
  options: SpeechOptions<Config>,
) => MaybePromise<SpeechResult | void>;

export interface WordbookRequest {
  sourceText: string;
  translatedText: string;
  /** Application language tags; not converted through the plugin language map. */
  sourceLanguage: string;
  targetLanguage: string;
  /** The normalized translation, including a populated word for dictionaries. */
  translationResult: string | { kind: "dictionary"; dictionary: DictionaryEntry };
}

/** A nonempty error or a false success/ok reports failure; message is user-facing. */
export interface WordbookReceipt {
  success?: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
}

/** false reports failure; true/null/undefined preserve any setResult message. */
export type WordbookResult = string | boolean | WordbookReceipt | null | void;
/** setResult records the latest nonblank receipt message. Throw to report failure. */
export type WordbookOptions<Config extends object = PluginConfig> = PluginOptions<string, Config>;

export type AddToWordbook<Config extends object = PluginConfig> = (
  request: WordbookRequest,
  options: WordbookOptions<Config>,
) => MaybePromise<WordbookResult>;

/** Desktop operations available only during an action's execution. */
export interface SelectionActions {
  copyToClipboard(text: string): void;
  replaceSelectedText(text: string): void;
  /** Only HTTP(S) URLs are accepted. */
  openWithDefaultBrowser(url: string): void;
}

export interface ActionOptions<Config extends object = PluginConfig> extends PluginOptions<string, Config> {
  readonly manggo: Readonly<SelectionActions>;
}

/**
 * No manggo capability is supplied. Prechecks have a 500 ms budget and cannot
 * use the network, write files or perform host actions. Only true enables the action.
 */
export type ActionPrecheckOptions<Config extends object = PluginConfig> = PluginOptions<string, Config>;

export type PrecheckAction<Config extends object = PluginConfig> = (
  text: string,
  options: ActionPrecheckOptions<Config>,
) => MaybePromise<boolean | void>;

/** Return values are ignored. Throw to report an action failure. */
export type RunAction<Config extends object = PluginConfig> = (
  text: string,
  options: ActionOptions<Config>,
) => MaybePromise<unknown>;

export type PluginKind = "translation" | "ocr" | "speech" | "wordbook" | "action";
export type ConfigControl = "text" | "password" | "textarea" | "select" | "integer" | "decimal" | "boolean";

export interface PluginConfigOption {
  label: string;
  value: JSONValue;
}

export interface PluginConfigField {
  key: string;
  label: string;
  control: ConfigControl;
  placeholder?: string;
  description?: string;
  required?: boolean;
  /** Defaults to true for password controls. */
  secret?: boolean;
  editable?: boolean;
  /** Missing native defaults become null; saved false/zero/empty values are kept. */
  default?: JSONValue;
  options?: PluginConfigOption[];
}

export interface PluginServiceBase {
  id: string;
  displayName: string;
  /** Exported function name; it need not match the names of the SDK's types. */
  entry: string;
  /** Defaults to the manifest's runtime.main. Paths are package-relative. */
  main?: string;
  /** Defaults to "<plugin id>#<service id>". */
  providerId?: string;
  /** Application language tag/alias to service code; nonempty mappings take precedence. */
  language?: Record<string, string | number | boolean>;
  config?: PluginConfigField[];
  /** Merged with the manifest's permissions. */
  permissions?: string[];
}

export type PluginService = PluginServiceBase & (
  | {
      kind: "translation";
      /** Defaults to text; dictionary returns require dictionary. */
      resultType?: "text" | "dictionary";
      /** Package-relative artwork; defaults to the manifest icon. */
      icon?: string;
    }
  | {
      kind: "ocr" | "speech" | "wordbook";
      icon?: string;
    }
  | {
      kind: "action";
      /** Material Symbols Rounded name. Defaults to extension. */
      iconName?: string;
      /** Exported PrecheckAction function name; omit to enable without a precheck. */
      precheck?: string;
      /** Defaults to true. */
      enabledByDefault?: boolean;
    }
);

/** Authoring shape of manggo.plugin.json. */
export interface PluginManifest {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  icon?: string;
  runtime: {
    /** Use moejs for new plugins; bun remains an accepted legacy declaration. */
    kind: "moejs" | "bun";
    api: "manggo.plugin.v1";
    main: string;
  };
  permissions?: string[];
  /** At least one service is required. */
  services: PluginService[];
}
