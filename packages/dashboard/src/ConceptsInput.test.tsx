import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConceptsInput, conceptsToText, textToConcepts } from './ConceptsInput.js';

describe('textToConcepts / conceptsToText', () => {
  it('parses a comma-separated string into a trimmed, non-empty array', () => {
    expect(textToConcepts('hashing, collisions,  chaining')).toEqual([
      'hashing',
      'collisions',
      'chaining',
    ]);
  });

  it('round-trips back to a comma-space-joined string', () => {
    expect(conceptsToText(['hashing', 'collisions'])).toBe('hashing, collisions');
  });
});

describe('ConceptsInput', () => {
  it('does not erase a trailing comma while typing (the actual reported bug)', async () => {
    // Previously the input's value was derived as
    // conceptsToText(textToConcepts(raw)) on every keystroke — a trailing
    // "," produces an empty last segment, which textToConcepts filters out,
    // so the comma the user just typed vanished from the displayed value
    // before they could type the next concept. Typing character-by-character
    // (not pasting the whole string in one event) is what actually exposes
    // this — a single paste event never hits the intermediate trailing-comma
    // state.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConceptsInput concepts={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hashing,');

    expect(input).toHaveValue('hashing,');
  });

  it('lets you keep typing the next concept right after the comma', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConceptsInput concepts={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hashing, collisions');

    expect(input).toHaveValue('hashing, collisions');
    expect(onChange).toHaveBeenLastCalledWith(['hashing', 'collisions']);
  });

  it('reports the parsed array on every keystroke, not just at the end', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConceptsInput concepts={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'hashing');

    expect(onChange).toHaveBeenCalledWith(['hashing']);
  });

  it('still works correctly for a single paste event, matching the already-working case', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ConceptsInput concepts={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste('hashing, collisions, chaining');

    expect(input).toHaveValue('hashing, collisions, chaining');
    expect(onChange).toHaveBeenLastCalledWith(['hashing', 'collisions', 'chaining']);
  });

  it('initializes its displayed text from the concepts prop', () => {
    render(<ConceptsInput concepts={['hashing', 'collisions']} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hashing, collisions');
  });
});
