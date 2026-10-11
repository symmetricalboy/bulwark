import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  GoogleTasksIcon,
  GoogleCalendarIcon,
  GoogleContactsIcon,
  GmailIcon,
} from '../index';

describe('Google Workspace Icons', () => {
  describe('GoogleTasksIcon', () => {
    it('renders vector Google Tasks icon with correct viewBox and checkmark path', () => {
      const { container } = render(<GoogleTasksIcon className="w-6 h-6 custom-tasks-class" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 192 192');
      expect(svg).toHaveClass('custom-tasks-class');

      const clipPaths = container.querySelectorAll('clipPath');
      expect(clipPaths.length).toBeGreaterThanOrEqual(2);

      const path = container.querySelector('path[d*="m61 90"]');
      expect(path).toBeInTheDocument();
    });
  });

  describe('GoogleCalendarIcon', () => {
    it('renders modern 2026 Material You Calendar icon with 96x96 viewBox', () => {
      const { container } = render(<GoogleCalendarIcon className="w-5 h-5 custom-cal-class" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 96 96');
      expect(svg).toHaveClass('custom-cal-class');

      const image = container.querySelector('image');
      expect(image).toBeInTheDocument();
      expect(image?.getAttribute('href')).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('GoogleContactsIcon', () => {
    it('renders modern 2022 Material You Contacts icon with 96x96 viewBox', () => {
      const { container } = render(<GoogleContactsIcon className="w-5 h-5 custom-contacts-class" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 96 96');
      expect(svg).toHaveClass('custom-contacts-class');

      const image = container.querySelector('image');
      expect(image).toBeInTheDocument();
      expect(image?.getAttribute('href')).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('GmailIcon', () => {
    it('renders official Gmail icon with 440x350 viewBox and high-DPI asset data URI', () => {
      const { container } = render(<GmailIcon className="w-6 h-6 custom-gmail-class" />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 440 350');
      expect(svg).toHaveClass('custom-gmail-class');

      const image = container.querySelector('image');
      expect(image).toBeInTheDocument();
      expect(image?.getAttribute('href')).toMatch(/^data:image\/png;base64,/);
    });
  });
});
