import type { CSSProperties } from 'react';

export interface AudioLevelMeterProps {
  /** Normalized 0..1 amplitude samples — one bar per entry. */
  levels: number[];
  /** Color/role of the meter: the AI's voice, or the candidate's mic. */
  variant: 'speaking' | 'listening';
  /** Renders a calm ambient pulse instead of reactive bars — used whenever live amplitude data isn't available. */
  isIdle?: boolean;
  className?: string;
}

/**
 * Purely presentational amplitude bars, shared by QuestionAudio (AI
 * speaking) and MicButton (candidate listening). Contains no Web Audio
 * code — callers own sampling the real data.
 */
export function AudioLevelMeter({ levels, variant, isIdle = false, className }: AudioLevelMeterProps) {
  const barCount = Math.max(levels.length, 3);
  const bars = Array.from({ length: barCount }, (_, i) => levels[i] ?? 0.08);

  const classes = ['isdk-audio-meter', `isdk-audio-meter--${variant}`, isIdle ? 'isdk-audio-meter--idle' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className ? `${classes} ${className}` : classes} aria-hidden="true">
      {bars.map((level, i) => (
        <span key={i} style={{ '--isdk-meter-level': Math.max(0.08, level) } as CSSProperties} />
      ))}
    </span>
  );
}
