import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Returns an HTML string with syntax-highlighted JSON spans.
 * Used in TopologyPreview via dangerouslySetInnerHTML.
 *
 * Keys            → color: var(--cf-cyan)
 * Strings         → color: var(--cf-green)
 * Numbers/booleans → color: var(--cf-amber)
 * Null            → color: var(--cf-amber)
 * Punctuation     → color: var(--cf-text-muted)
 */
export function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g,
    (match) => {
      let cls = 'color: var(--cf-text-muted)'; // punctuation default
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'color: var(--cf-cyan)'; // key
        } else {
          cls = 'color: var(--cf-green)'; // string value
        }
      } else if (/true|false|null/.test(match)) {
        cls = 'color: var(--cf-amber)';
      } else if (/^-?\d/.test(match)) {
        cls = 'color: var(--cf-amber)';
      }
      return `<span style="${cls}">${match}</span>`;
    }
  );
}
