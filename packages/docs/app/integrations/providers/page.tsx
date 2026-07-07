import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI & voice provider guides' };

export default function Providers() {
  return (
    <>
      <h1>AI &amp; voice provider guides</h1>
      <p className="docs-lede">
        Every adapter implements the same <code>AIProviderAdapter</code> or{' '}
        <code>VoiceProviderAdapter</code> interface from <code>@interview-sdk/core</code> and
        normalizes provider errors onto the same <code>Provider*Error</code> taxonomy, so{' '}
        <code>withRetry</code> and <code>FailoverAdapter</code> work identically regardless of which
        one you use. Swapping providers is a one-line change: construct the new adapter and pass it
        to the same <code>adapter</code> prop/option everywhere else already expects one.
      </p>

      <h2>OpenAI</h2>
      <p>
        Built on the official <code>openai</code> SDK&apos;s <strong>Responses API</strong> (
        <code>client.responses.create</code>).
      </p>
      <pre>
        <code>{`npm install @interview-sdk/core @interview-sdk/adapter-openai`}</code>
      </pre>
      <pre>
        <code>{`import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });`}</code>
      </pre>
      <p>
        Optional <code>model</code> (defaults to <code>gpt-5.4-mini</code>; pass{' '}
        <code>gpt-5.5</code> for the frontier model) and an optional pre-configured{' '}
        <code>client</code> for testing or a custom base URL.
      </p>

      <h2>Anthropic Claude</h2>
      <p>
        Built on the official <code>@anthropic-ai/sdk</code> (Messages API).
      </p>
      <pre>
        <code>{`npm install @interview-sdk/core @interview-sdk/adapter-claude`}</code>
      </pre>
      <pre>
        <code>{`import { ClaudeAdapter } from '@interview-sdk/adapter-claude';
new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });`}</code>
      </pre>
      <p>
        Optional <code>model</code> (defaults to <code>claude-opus-4-8</code>). Treats a{' '}
        <code>stop_reason: &quot;refusal&quot;</code> (Claude&apos;s safety-classifier decline) as
        an error rather than silently returning empty content.
      </p>

      <h2>Google Gemini</h2>
      <p>
        Built on <code>@google/genai</code>, Google&apos;s current unified SDK — the older{' '}
        <code>@google/generative-ai</code> package reached end-of-life on 2025-11-30 and is
        deliberately not used.
      </p>
      <pre>
        <code>{`npm install @interview-sdk/core @interview-sdk/adapter-gemini`}</code>
      </pre>
      <pre>
        <code>{`import { GeminiAdapter } from '@interview-sdk/adapter-gemini';
new GeminiAdapter({ apiKey: process.env.GEMINI_API_KEY });`}</code>
      </pre>
      <p>
        Optional <code>model</code> (defaults to <code>gemini-3.5-flash</code>; pass{' '}
        <code>gemini-3.1-pro</code> for heavier reasoning). Unlike the other text adapters, this one
        opts into retries explicitly — <code>@google/genai</code> doesn&apos;t retry
        rate-limit/server errors by default.
      </p>

      <h2>Deepgram (voice)</h2>
      <p>
        Built on <code>@deepgram/sdk</code> v5. Implements both <code>transcribe()</code> (primary
        use case) and <code>synthesize()</code>.
      </p>
      <pre>
        <code>{`npm install @interview-sdk/core @interview-sdk/adapter-deepgram`}</code>
      </pre>
      <pre>
        <code>{`import { DeepgramAdapter } from '@interview-sdk/adapter-deepgram';
new DeepgramAdapter({ apiKey: process.env.DEEPGRAM_API_KEY });`}</code>
      </pre>
      <p>
        Optional <code>model</code> (transcription, defaults to <code>nova-3</code>) and{' '}
        <code>speakModel</code> (TTS, defaults to <code>aura-2-thalia-en</code>).
      </p>

      <h2>ElevenLabs (voice)</h2>
      <p>
        Built on <code>@elevenlabs/elevenlabs-js</code> — the unscoped <code>elevenlabs</code>{' '}
        package is deprecated. Implements both <code>synthesize()</code> (primary use case) and{' '}
        <code>transcribe()</code>.
      </p>
      <pre>
        <code>{`npm install @interview-sdk/core @interview-sdk/adapter-elevenlabs`}</code>
      </pre>
      <pre>
        <code>{`import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';
new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY });`}</code>
      </pre>
      <p>
        Optional <code>voiceId</code> (defaults to the prebuilt &quot;Rachel&quot; voice),{' '}
        <code>model</code> (TTS, defaults to <code>eleven_multilingual_v2</code>), and{' '}
        <code>transcribeModel</code> (STT, defaults to <code>scribe_v2</code>).
      </p>

      <h2>Using an adapter</h2>
      <p>
        Construct the adapter and pass it directly wherever this SDK expects one —{' '}
        <code>{`<InterviewWidget adapter={...}>`}</code> in Client Mode, or the <code>adapter</code>{' '}
        constructor option on <code>ServerAnswerProcessor</code> in Server Mode:
      </p>
      <pre>
        <code>{`import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const adapter = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });
// <InterviewWidget adapter={adapter} mode="client" ... />
// or: new ServerAnswerProcessor({ questions, rubric, adapter })`}</code>
      </pre>
      <p>
        <code>AdapterRegistry</code> (from <code>@interview-sdk/core</code>) is a separate, optional
        utility for a narrower case: your own app looking an adapter up by string id at runtime,
        e.g. a multi-tenant app where each customer&apos;s provider is chosen by data rather than by
        your source code. It&apos;s not a required step — most apps never need it:
      </p>
      <pre>
        <code>{`import { AdapterRegistry } from '@interview-sdk/core';
import { DeepgramAdapter } from '@interview-sdk/adapter-deepgram';

const registry = new AdapterRegistry();
registry.registerAIProvider(new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY }));
registry.registerVoiceProvider(new DeepgramAdapter({ apiKey: process.env.DEEPGRAM_API_KEY }));

const adapter = registry.getAIProvider('openai'); // then pass this to InterviewWidget/the processor as usual`}</code>
      </pre>

      <h2>Multi-provider failover</h2>
      <p>
        Wrap several adapters in <code>FailoverAdapter</code> to try each in order on a
        failover-eligible error (auth, rate limit, overload, connection, timeout, invalid request):
      </p>
      <pre>
        <code>{`import { FailoverAdapter } from '@interview-sdk/core';

const adapter = new FailoverAdapter({
  adapters: [new OpenAIAdapter({ apiKey: OPENAI_KEY }), new ClaudeAdapter({ apiKey: ANTHROPIC_KEY })],
});`}</code>
      </pre>
      <p>
        Every adapter here is verified against a specific SDK version as of 2026-07-04 — model names
        and error taxonomies shift quickly; check each package&apos;s own README before assuming
        details stay accurate for long.
      </p>
    </>
  );
}
