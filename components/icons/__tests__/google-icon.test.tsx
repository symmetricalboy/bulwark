import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoogleIcon } from '../google-icon';

describe('GoogleIcon', () => {
  it('renders with updated Google G viewBox, clipPath, and multi-stop gradient stops', () => {
    const { container } = render(<GoogleIcon className="w-6 h-6 custom-class" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 268.152 273.883');
    expect(svg).toHaveClass('custom-class');

    const clipPath = container.querySelector('clipPath');
    expect(clipPath).toBeInTheDocument();

    const radialGradients = container.querySelectorAll('radialGradient');
    expect(radialGradients.length).toBeGreaterThanOrEqual(7);

    const linearGradients = container.querySelectorAll('linearGradient');
    expect(linearGradients.length).toBeGreaterThanOrEqual(1);

    const stops = container.querySelectorAll('stop');
    const stopColors = Array.from(stops).map((s) => s.getAttribute('stop-color')?.toLowerCase());

    // Red & coral gradient stops
    expect(stopColors).toContain('#ff4541');
    expect(stopColors).toContain('#fb4e5a');

    // Yellow & amber gradient stops
    expect(stopColors).toContain('#ffce0a');
    expect(stopColors).toContain('#fdcd01');

    // Green gradient stops
    expect(stopColors).toContain('#0fbc5c');
    expect(stopColors).toContain('#0fbc5f');

    // Blue & cyan gradient stops
    expect(stopColors).toContain('#3086ff');

    const clippedGroup = container.querySelector('g[clip-path]');
    expect(clippedGroup).toBeInTheDocument();
  });
});
