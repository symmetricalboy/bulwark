import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoogleDriveIcon } from '../google-drive-icon';

describe('GoogleDriveIcon', () => {
  it('renders with 2026 Google Drive viewBox, rounded clipPath, and official gradient stops', () => {
    const { container } = render(<GoogleDriveIcon className="w-6 h-6 custom-class" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 192 192');
    expect(svg).toHaveClass('custom-class');

    const clipPath = container.querySelector('clipPath');
    expect(clipPath).toBeInTheDocument();

    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients).toHaveLength(3);

    const stops = container.querySelectorAll('stop');
    const stopColors = Array.from(stops).map((s) => s.getAttribute('stop-color'));

    // Yellow gradient stops
    expect(stopColors).toContain('#ffe921');
    expect(stopColors).toContain('#fec700');

    // Blue / periwinkle gradient stops
    expect(stopColors).toContain('#a9a8ff');
    expect(stopColors).toContain('#6d97ff');
    expect(stopColors).toContain('#3186ff');

    // Green / cyan gradient stops
    expect(stopColors).toContain('#0ebc5f');
    expect(stopColors).toContain('#78c9ff');

    const clippedGroup = container.querySelector('g[clip-path]');
    expect(clippedGroup).toBeInTheDocument();
    const paths = clippedGroup?.querySelectorAll('path');
    expect(paths).toHaveLength(3);
  });
});
