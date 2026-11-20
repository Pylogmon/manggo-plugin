/**
 * Manggo native plugin API 1.1 (manifest protocol: manggo.plugin.v1).
 * These are development-only types; publish JavaScript and use type-only imports.
 * Web APIs such as fetch use the TypeScript DOM library. Bob and Pot have their
 * own compatibility contracts; their extra APIs are not native PluginUtils.
 */
export type MaybePromise<T> = T | Promise<T>;
export type PluginConfig = Record<string, unknown>;
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

/** Public information about the current application and plugin environment. */
export interface PluginEnvironment {
  readonly appVersion: string;
  readonly apiVersion: "1.1";
  readonly engine: "moejs";
  readonly engineVersion: string;
  readonly platform: "darwin" | "windows" | "linux";
  readonly arch: string;
  /** Implemented interfaces; desktop actions additionally require permissions. */
  readonly capabilities: readonly string[];
}

export interface ServiceErrorOptions {
  /** HTTP(S) link displayed by configuration checks and translation cards. */
  troubleshootingLink?: string;
  /** JSON-serializable debug details, at most 4 KiB. Do not include secrets. */
  addition?: JSONValue;
}

export interface ServiceErrorDetails extends ServiceErrorOptions {
  /** e.g. secretKey, unsupportedLanguage, notFound, network, api, validation. */
  type: string;
  /** User-facing message, at most 4 KiB. */
  message: string;
}

export interface ServiceError extends Error, ServiceErrorDetails {}

/** Each message is limited to 4 KiB; the invocation's total is 64 KiB. */
export interface PluginLogger {
  debug(...values: unknown[]): void;
  info(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
}

export type SQLiteParameter = string | number | boolean | null | ArrayBuffer | Uint8Array;
export type SQLiteRow = Record<string, string | number | null | ArrayBuffer>;

/** A connection scoped to the current invocation. BLOB columns are ArrayBuffers. */
export interface SQLiteDatabase {
  query<Row extends object = SQLiteRow>(statement: string, parameters?: readonly SQLiteParameter[]): Promise<Row[]>;
  close(): Promise<void>;
}

export interface SQLiteWriteResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SQLiteWritableDatabase extends SQLiteDatabase {
  execute(statement: string, parameters?: readonly SQLiteParameter[]): Promise<SQLiteWriteResult>;
}

export interface SQLiteOpenOptions {
  /** Defaults to readOnly. readWrite uses bundled data to initialize a private database on first open. */
  mode?: "readOnly" | "readWrite";
}

/** Relative paths address bundled files. /data/ paths address plugin-private databases. */
export interface SQLiteAPI {
  open(path: string, options: { mode: "readWrite" }): Promise<Readonly<SQLiteWritableDatabase>>;
  open(path: string, options?: { mode?: "readOnly" }): Promise<Readonly<SQLiteDatabase>>;
  open(path: string, options: SQLiteOpenOptions): Promise<Readonly<SQLiteDatabase | SQLiteWritableDatabase>>;
}

/** Common native API. Available in options except action prechecks. */
export interface HostAPI {
  readonly env: Readonly<PluginEnvironment>;
  readonly log: Readonly<PluginLogger>;
  readonly ServiceError: new (type: string, message: string, options?: ServiceErrorOptions) => ServiceError;
  /** Native SQLite support `sqlite`. Action prechecks can only open read-only connections. */
  readonly sqlite: Readonly<SQLiteAPI>;
}

/** Translation languages have already passed through the service language map. */
export interface PluginQuery {
  readonly text: string;
  /** Original input before text preprocessing; otherwise falls back to text. */
  readonly originalText: string;
  readonly from: string;
  readonly to: string;
  readonly detectFrom: string;
  readonly detectTo: string;
}

/** Connection options for the WebSocket constructor in native plugins. */
export interface PluginWebSocketOptions {
  /** Headers sent when opening the connection. */
  headers?: HeadersInit;
  /** Subprotocols offered to the server. */
  protocols?: string | Iterable<string>;
}

/** Type for the global WebSocket constructor when using connection options. */
export type PluginWebSocketConstructor = typeof globalThis.WebSocket & {
  new (url: string | URL, options: PluginWebSocketOptions): WebSocket;
};

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

export interface PluginOptions<StreamResult = string, Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> {
  /** Shared settings and instance settings with defaults; instance keys win. */
  config: Config;
  /** Only the plugin-level fields declared by this manifest are provided. */
  sharedConfig: SharedConfig;
  /** Mapped detected source language, falling back to from; empty for other kinds. */
  detect: string;
  /** Bound to this invocation's cancellation, including its deadline. */
  readonly signal: AbortSignal;
  readonly query: Readonly<PluginQuery>;
  readonly manggo: Readonly<HostAPI>;
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

export type TranslationFormat = "plain" | "markdown" | "lines";

/** URL and inline Base64 are mutually exclusive; bytes are validated at playback. */
export type TranslationAudio = { contentType?: string } & (
  | { url: string; base64?: never }
  | { base64: string; url?: never }
);

/** Requires resultType: "structured". Optional fields must be omitted, not null. */
export interface StructuredTranslationResult {
  kind: "translation";
  text: string;
  /** Markdown also honors the user's rendering preference. */
  format?: TranslationFormat;
  /** Displayed separately; excluded from copying, speaking and translation text. */
  thinking?: string;
  from?: string;
  to?: string;
  audio?: TranslationAudio;
}

export type TranslationResult = string | DictionaryResult | StructuredTranslationResult;

export interface GlossaryTerm {
  readonly source: string;
  readonly target: string;
}

export interface PluginGlossary {
  /** All enabled terms for this request's language pair when the service declares glossary: true. */
  getTerms(): readonly GlossaryTerm[];
}

/** Strings append deltas; structured values are authoritative snapshots. */
export interface TranslationOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> extends PluginOptions<string | StructuredTranslationResult, Config, SharedConfig> {
  readonly glossary: Readonly<PluginGlossary>;
}

/**
 * Text deltas take precedence over a returned string when any text was emitted.
 * A returned dictionary takes precedence and requires resultType: "dictionary"
 * in the service manifest. Structured translations require resultType:
 * "structured"; their explicit return replaces earlier snapshots/text. With
 * no return, the latest structured snapshot or accumulated text is the result.
 */
export type Translate<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  text: string,
  /** Source code after applying the service's manifest language map. */
  from: string,
  /** Target code after applying the service's manifest language map. */
  to: string,
  options: TranslationOptions<Config, SharedConfig>,
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
export interface OCROptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> extends PluginOptions<string | OCRResult, Config, SharedConfig> {
  readonly image: { readonly pixelWidth: number; readonly pixelHeight: number };
}

export type Recognize<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  /** PNG image bytes encoded as base64 without a data URI prefix. */
  base64: string,
  /** Code after applying the service's manifest language map. */
  language: string,
  options: OCROptions<Config, SharedConfig>,
) => MaybePromise<string | OCRResult | void>;

export interface AudioFormat {
  /** Format hints are checked in this order, then service configuration is used. */
  format?: string;
  audioFormat?: string;
  responseFormat?: string;
  mimeType?: string;
  contentType?: string;
}

/** Numeric-key byte object; keys must be contiguous starting at zero. */
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
export type SpeechOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = PluginOptions<SpeechCandidate, Config, SharedConfig>;

/** An explicit return value takes precedence over candidates sent to setResult. */
export type Speak<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  text: string,
  /** Code after applying the service's manifest language map. */
  language: string,
  options: SpeechOptions<Config, SharedConfig>,
) => MaybePromise<SpeechResult | void>;

export interface WordbookRequest {
  sourceText: string;
  translatedText: string;
  /** Application language tags; not converted through the plugin language map. */
  sourceLanguage: string;
  targetLanguage: string;
  /** The normalized translation, including a populated word for dictionaries. */
  translationResult: string | StructuredTranslationResult | { kind: "dictionary"; dictionary: DictionaryEntry };
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
export type WordbookOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = PluginOptions<string, Config, SharedConfig>;

export type AddToWordbook<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  request: WordbookRequest,
  options: WordbookOptions<Config, SharedConfig>,
) => MaybePromise<WordbookResult>;

/** Desktop operations available only during an action's execution. */
export interface SelectionActions extends HostAPI {
  copyToClipboard(text: string): void;
  replaceSelectedText(text: string): void;
  /** Only HTTP(S) URLs are accepted. */
  openWithDefaultBrowser(url: string): void;
  /** Requires desktop.openURI. Uses an application protocol registered by the OS. */
  openURI(uri: string): void;
  /** Requires desktop.openPath. Opens an existing absolute path using its default application. */
  openPath(path: string): void;
  /** Requires desktop.reveal. On Linux, may fall back to opening the parent directory. */
  revealFile(path: string): void;
  /** Requires desktop.launch. Absolute executable path or macOS .app; no shell parsing. */
  launchApplication(path: string, args?: string[]): void;
}

export interface ActionOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> extends PluginOptions<string, Config, SharedConfig> {
  readonly manggo: Readonly<SelectionActions>;
}

/**
 * No options.manggo object is supplied. Prechecks have a 500 ms budget and cannot
 * use the network, write files or perform host actions. Only true enables the action.
 */
export type ActionPrecheckOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = Omit<PluginOptions<string, Config, SharedConfig>, "manggo">;

export type PrecheckAction<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  text: string,
  options: ActionPrecheckOptions<Config, SharedConfig>,
) => MaybePromise<boolean | void>;

/** Return values are ignored. Throw to report an action failure. */
export type RunAction<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  text: string,
  options: ActionOptions<Config, SharedConfig>,
) => MaybePromise<unknown>;

/** Validation receives the unsaved draft and common APIs; no desktop actions. */
export type ValidationOptions<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = PluginOptions<unknown, Config, SharedConfig>;
export type ValidationResult = boolean | { result: boolean; error?: ServiceErrorDetails };
export type ValidateConfig<Config extends object = PluginConfig, SharedConfig extends object = PluginConfig> = (
  options: ValidationOptions<Config, SharedConfig>,
) => MaybePromise<ValidationResult>;

export interface PluginRequirements {
  /** Stable three-part application version, e.g. 1.3.1. */
  minAppVersion?: string;
  capabilities?: string[];
  platforms?: Array<"darwin" | "windows" | "linux">;
}

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
  /** Configuration check entry. Omitted: try the optional exported validate. */
  validate?: string;
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
      /** Defaults to text; dictionaries and rich translations declare their respective type. */
      resultType?: "text" | "dictionary" | "structured";
      /** Pass terms to the plugin so it can apply them using its own translation service. */
      glossary?: boolean;
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
  requires?: PluginRequirements;
  /** Shared settings for this plugin; services[].config overrides same-name keys. */
  config?: PluginConfigField[];
  /** At least one service is required. */
  services: PluginService[];
}

declare global {
  /** Import this SDK for global typing; action-specific methods use options.manggo. */
  const manggo: Readonly<HostAPI>;
}
