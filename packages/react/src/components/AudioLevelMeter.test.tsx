import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioLevelMeter } from './AudioLevelMeter.js';

describe('AudioLevelMeter', () => {
  it('renders one bar per level entry', () => {
    const { container } = render(<AudioLevelMeter levels={[0.1, 0.5, 0.9]} variant="speaking" />);
    expect(container.querySelectorAll('span > span')).toHaveLength(3);
  });

  it('pads up to a minimum of 3 bars for very short level arrays', () => {
    const { container } = render(<AudioLevelMeter levels={[0.4]} variant="listening" />);
    expect(container.querySelectorAll('span > span')).toHaveLength(3);
  });

  it('applies the variant modifier class', () => {
    const { container } = render(<AudioLevelMeter levels={[0.1, 0.2, 0.3]} variant="listening" />);
    expect(container.firstChild).toHaveClass('isdk-audio-meter--listening');
  });

  it('applies the idle modifier class when isIdle is set', () => {
    const { container } = render(<AudioLevelMeter levels={[0, 0, 0]} variant="speaking" isIdle />);
    expect(container.firstChild).toHaveClass('isdk-audio-meter--idle');
  });

  it('is decorative — hidden from the accessibility tree', () => {
    const { container } = render(<AudioLevelMeter levels={[0.1, 0.2, 0.3]} variant="speaking" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
