/**
 * Smoke test — proves the Jest + RTL + jest-dom pipeline is wired up correctly.
 * Phase 1 will replace this with real unit tests for the SOP matcher and schemas.
 */
import { render, screen } from '@testing-library/react';

describe('Jest + React Testing Library setup', () => {
  it('runs a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders a React component and uses a jest-dom matcher', () => {
    render(<h1>Clinical Routing Assistant</h1>);
    expect(
      screen.getByRole('heading', { name: /clinical routing assistant/i }),
    ).toBeInTheDocument();
  });
});
