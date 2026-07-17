declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_ELEVENLABS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
