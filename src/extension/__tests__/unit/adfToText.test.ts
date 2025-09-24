import { adfToText } from '../../utils/adfToText';

describe('adfToText', () => {
  it('returns empty string for null input', () => {
    expect(adfToText(null)).toBe('');
  });

  it('returns string as-is if input is a plain string', () => {
    expect(adfToText('hello')).toBe('hello');
  });

  it('converts a simple paragraph node', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(adfToText(adf).trim()).toBe('Hello world');
  });

  it('converts heading nodes', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'My Heading' }],
        },
      ],
    };
    expect(adfToText(adf).trim()).toBe('## My Heading');
  });

  it('converts bullet list nodes', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item one' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toContain('• Item one');
  });

  it('skips media nodes', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'mediaSingle', content: [] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After media' }],
        },
      ],
    };
    expect(adfToText(adf).trim()).toBe('After media');
  });
});