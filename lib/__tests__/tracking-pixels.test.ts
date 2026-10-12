import { describe, expect, it } from 'vitest';
import { sanitizeEmailBodyForIframe } from '../email-sanitization';

const strip = (html: string, blockExternal = false) =>
  sanitizeEmailBodyForIframe(html, blockExternal, { stripTrackingPixels: true });

describe('tracking pixel stripping', () => {
  it('removes 1x1 remote images by attribute size', () => {
    const { html } = strip('<p>Hi</p><img src="https://news.example.com/o.gif" width="1" height="1">');
    expect(html).not.toContain('<img');
    expect(html).toContain('Hi');
  });

  it('removes remote images hidden or shrunk via inline style', () => {
    expect(strip('<img src="https://x.example/a.png" style="display:none">').html).not.toContain('<img');
    expect(strip('<img src="https://x.example/a.png" style="width:0px;height:0px">').html).not.toContain('<img');
    expect(strip('<img src="https://x.example/a.png" style="opacity:0">').html).not.toContain('<img');
  });

  it('removes images from known tracking hosts and open-tracking paths', () => {
    expect(strip('<img src="https://mailtrack.io/trace/mail/abc.png" width="600">').html).not.toContain('<img');
    expect(strip('<img src="https://brand.example.com/wf/open?upn=xyz">').html).not.toContain('<img');
  });

  it('keeps normal remote images and inline images', () => {
    const remote = strip('<img src="https://cdn.example.com/hero.jpg" width="600" height="300">').html;
    expect(remote).toContain('hero.jpg');
    const inline = strip('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1" height="1">').html;
    expect(inline).toContain('<img');
  });

  it('does not raise the blocked-content banner for a stripped pixel', () => {
    const result = strip('<img src="https://t.example/p.gif" width="1" height="1">', true);
    expect(result.blockedExternalContent).toBe(false);
  });

  it('is a no-op when the option is off', () => {
    const { html } = sanitizeEmailBodyForIframe('<img src="https://t.example/p.gif" width="1" height="1">', false);
    expect(html).toContain('<img');
  });
});
