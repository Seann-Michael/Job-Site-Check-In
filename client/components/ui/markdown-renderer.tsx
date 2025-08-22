import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableMentions?: boolean;
  searchHighlight?: string;
}

// Simple markdown parser for chat messages
class MarkdownParser {
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static parse(content: string): React.ReactNode[] {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle code blocks
      if (line.trim().startsWith('```')) {
        const language = line.trim().slice(3).trim();
        const codeLines: string[] = [];
        i++; // Skip the opening ```
        
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        
        elements.push(
          <div key={currentIndex++} className="my-2">
            <pre className="bg-muted p-3 rounded-md overflow-x-auto">
              <code className={`text-sm ${language ? `language-${language}` : ''}`}>
                {codeLines.join('\n')}
              </code>
            </pre>
          </div>
        );
        continue;
      }
      
      // Handle blockquotes
      if (line.trim().startsWith('>')) {
        const quoteText = line.trim().slice(1).trim();
        elements.push(
          <blockquote key={currentIndex++} className="border-l-4 border-muted-foreground/20 pl-4 my-2 italic text-muted-foreground">
            {this.parseInlineMarkdown(quoteText)}
          </blockquote>
        );
        continue;
      }
      
      // Handle headers
      if (line.trim().startsWith('#')) {
        const headerMatch = line.match(/^(#+)\s*(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
          const sizes = {
            1: 'text-2xl font-bold',
            2: 'text-xl font-bold', 
            3: 'text-lg font-semibold',
            4: 'text-base font-semibold',
            5: 'text-sm font-semibold',
            6: 'text-xs font-semibold'
          };
          
          elements.push(
            <HeaderTag key={currentIndex++} className={`${sizes[level as keyof typeof sizes]} my-2`}>
              {this.parseInlineMarkdown(text)}
            </HeaderTag>
          );
          continue;
        }
      }
      
      // Handle lists
      if (line.trim().match(/^[\-\*\+]\s+/) || line.trim().match(/^\d+\.\s+/)) {
        const listItems: string[] = [];
        const isOrdered = line.trim().match(/^\d+\.\s+/);
        
        // Collect consecutive list items
        let j = i;
        while (j < lines.length) {
          const currentLine = lines[j].trim();
          if (currentLine.match(/^[\-\*\+]\s+/) || currentLine.match(/^\d+\.\s+/)) {
            const itemText = currentLine.replace(/^[\-\*\+\d\.]\s+/, '');
            listItems.push(itemText);
            j++;
          } else if (currentLine === '') {
            j++;
            break;
          } else {
            break;
          }
        }
        
        const ListTag = isOrdered ? 'ol' : 'ul';
        elements.push(
          <ListTag key={currentIndex++} className={`my-2 ml-4 ${isOrdered ? 'list-decimal' : 'list-disc'}`}>
            {listItems.map((item, idx) => (
              <li key={idx} className="mb-1">
                {this.parseInlineMarkdown(item)}
              </li>
            ))}
          </ListTag>
        );
        
        i = j - 1; // Adjust for the outer loop increment
        continue;
      }
      
      // Handle horizontal rules
      if (line.trim().match(/^[\-\*\_]{3,}$/)) {
        elements.push(
          <hr key={currentIndex++} className="my-4 border-muted-foreground/20" />
        );
        continue;
      }
      
      // Handle empty lines
      if (line.trim() === '') {
        if (elements.length > 0) {
          elements.push(<br key={currentIndex++} />);
        }
        continue;
      }
      
      // Regular paragraph
      elements.push(
        <p key={currentIndex++} className="my-1">
          {this.parseInlineMarkdown(line)}
        </p>
      );
    }

    return elements.length > 0 ? elements : [content];
  }

  private static parseInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    // Define patterns in order of precedence
    const patterns = [
      // Inline code (highest precedence)
      { 
        regex: /`([^`]+)`/g, 
        render: (match: string, content: string) => (
          <code key={keyIndex++} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
            {content}
          </code>
        )
      },
      // Bold
      { 
        regex: /\*\*([^*]+)\*\*/g,
        render: (match: string, content: string) => (
          <strong key={keyIndex++} className="font-bold">
            {content}
          </strong>
        )
      },
      // Italic
      { 
        regex: /\*([^*]+)\*/g,
        render: (match: string, content: string) => (
          <em key={keyIndex++} className="italic">
            {content}
          </em>
        )
      },
      // Strikethrough
      { 
        regex: /~~([^~]+)~~/g,
        render: (match: string, content: string) => (
          <span key={keyIndex++} className="line-through">
            {content}
          </span>
        )
      },
      // Links
      { 
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        render: (match: string, text: string, url: string) => (
          <a 
            key={keyIndex++} 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {text}
          </a>
        )
      },
      // Auto-links
      { 
        regex: /(https?:\/\/[^\s]+)/g,
        render: (match: string, url: string) => (
          <a 
            key={keyIndex++} 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {url}
          </a>
        )
      }
    ];

    let lastIndex = 0;
    const matches: Array<{ index: number; length: number; element: React.ReactNode }> = [];

    // Find all matches
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      
      while ((match = regex.exec(text)) !== null) {
        // Check if this match overlaps with existing matches
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        
        const hasOverlap = matches.some(existing => 
          (matchStart < existing.index + existing.length && matchEnd > existing.index)
        );
        
        if (!hasOverlap) {
          const element = pattern.render(match[0], match[1], match[2]);
          matches.push({
            index: matchStart,
            length: match[0].length,
            element
          });
        }
      }
    });

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build the result
    let currentIndex = 0;
    matches.forEach(match => {
      // Add text before this match
      if (match.index > currentIndex) {
        const textBefore = text.slice(currentIndex, match.index);
        if (textBefore) {
          parts.push(textBefore);
        }
      }
      
      // Add the matched element
      parts.push(match.element);
      
      currentIndex = match.index + match.length;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }

    return parts.length > 0 ? parts : [text];
  }
}

// Highlight mentions in markdown content
function highlightMentions(content: string): string {
  return content.replace(/@([^\s]+)/g, '**@$1**');
}

// Highlight search terms in markdown content
function highlightSearchTerms(content: string, searchTerm: string): string {
  if (!searchTerm.trim()) return content;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return content.replace(regex, '===$1==='); // Use special markers for search highlights
}

// Post-process search highlights after markdown parsing
function addSearchHighlights(elements: React.ReactNode[], searchTerm: string): React.ReactNode[] {
  if (!searchTerm.trim()) return elements;
  
  return elements.map((element, index) => {
    if (typeof element === 'string') {
      if (element.includes('===') && element.includes('===')) {
        const parts = element.split(/(===.*?===)/g);
        return parts.map((part, partIndex) => {
          if (part.startsWith('===') && part.endsWith('===')) {
            const highlightText = part.slice(3, -3);
            return (
              <span key={`${index}-${partIndex}`} className="bg-yellow-200 dark:bg-yellow-800 font-medium">
                {highlightText}
              </span>
            );
          }
          return part;
        });
      }
    }
    return element;
  });
}

export function MarkdownRenderer({ 
  content, 
  className, 
  enableMentions = false,
  searchHighlight 
}: MarkdownRendererProps) {
  let processedContent = content;
  
  // Process mentions
  if (enableMentions) {
    processedContent = highlightMentions(processedContent);
  }
  
  // Process search highlights
  if (searchHighlight) {
    processedContent = highlightSearchTerms(processedContent, searchHighlight);
  }
  
  // Parse markdown
  let elements = MarkdownParser.parse(processedContent);
  
  // Add search highlights after markdown parsing
  if (searchHighlight) {
    elements = addSearchHighlights(elements, searchHighlight);
  }
  
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      {elements}
    </div>
  );
}

// Helper component for markdown preview mode
interface MarkdownPreviewProps {
  content: string;
  isPreview: boolean;
  enableMentions?: boolean;
  className?: string;
}

export function MarkdownPreview({ 
  content, 
  isPreview, 
  enableMentions,
  className 
}: MarkdownPreviewProps) {
  if (!isPreview) {
    return (
      <pre className={cn("whitespace-pre-wrap font-sans", className)}>
        {content}
      </pre>
    );
  }
  
  return (
    <MarkdownRenderer 
      content={content} 
      enableMentions={enableMentions}
      className={className}
    />
  );
}

// Utility function to check if content contains markdown
export function hasMarkdownSyntax(content: string): boolean {
  const markdownPatterns = [
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /`[^`]+`/, // Inline code
    /```[\s\S]*?```/, // Code blocks
    /^#{1,6}\s+/, // Headers
    /^[\-\*\+]\s+/, // Lists
    /^\d+\.\s+/, // Numbered lists
    /^>\s+/, // Blockquotes
    /\[([^\]]+)\]\(([^)]+)\)/, // Links
    /~~[^~]+~~/, // Strikethrough
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
}

// Utility function to get markdown help text
export function getMarkdownHelp(): React.ReactNode {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <div className="font-medium">Markdown supported:</div>
      <div>**bold** *italic* `code` ~~strikethrough~~</div>
      <div>```code blocks``` {'>'} quotes # headers</div>
      <div>[links](url) - lists 1. numbered lists</div>
    </div>
  );
}
