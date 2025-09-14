// Atlassian Document Format → plain text
// ADF spec: https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') {
    return typeof adf === 'string' ? adf : '';
  }

  const node = adf as AdfNode;
  return processNode(node).trim();
}

function processNode(node: AdfNode): string {
  // Leaf text node
  if (node.type === 'text') {
    return node.text ?? '';
  }

  // Nodes we skip entirely
  if (['mediaGroup', 'mediaSingle', 'media', 'emoji'].includes(node.type)) {
    return '';
  }

  const children = node.content?.map(processNode).join('') ?? '';

  switch (node.type) {
    case 'doc':
      return children;

    case 'paragraph':
      return children + '\n\n';

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${children}\n\n`;
    }

    case 'bulletList':
    case 'orderedList':
      return children + '\n';

    case 'listItem':
      return `• ${children.trim()}\n`;

    case 'codeBlock':
      return `\`\`\`\n${children}\n\`\`\`\n\n`;

    case 'inlineCode':
      return `\`${children}\``;

    case 'blockquote':
      return children
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n\n';

    case 'rule':
      return '\n---\n\n';

    case 'hardBreak':
      return '\n';

    case 'mention':
      return `@${node.attrs?.text ?? 'unknown'}`;

    default:
      return children;
  }
}