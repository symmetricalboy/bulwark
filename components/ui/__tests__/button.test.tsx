import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';
import { PenSquare } from '@/components/icons';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });

  it('renders different variants without errors', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByText('Default')).toBeInTheDocument();

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText('Ghost')).toBeInTheDocument();

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByText('Outline')).toBeInTheDocument();

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByText('Destructive')).toBeInTheDocument();
  });

  it('guarantees high-contrast icon rendering inside default and destructive buttons', () => {
    // Render an icon inside a primary Button
    const { container } = render(
      <Button variant="default">
        <PenSquare data-testid="compose-icon" />
        Compose
      </Button>
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // The icon must not have an inline style overriding the color with an accent shade
    expect(svg?.style.color).toBe('');
  });
});
