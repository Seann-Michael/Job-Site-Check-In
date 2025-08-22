import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Card, CardContent } from './card';
import { ScrollArea } from './scroll-area';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  raw_user_meta_data?: any;
}

interface MentionUser extends User {
  display_name: string;
  initials: string;
}

interface MentionAutocompleteProps {
  users: User[];
  onMentionSelect: (user: MentionUser) => void;
  onClose: () => void;
  query: string;
  position: { top: number; left: number };
  className?: string;
}

const getUserDisplayName = (user: User): string => {
  return user?.raw_user_meta_data?.full_name || 
         user?.raw_user_meta_data?.name || 
         user?.email?.split('@')[0] || 
         'Unknown User';
};

const getUserInitials = (user: User): string => {
  const name = getUserDisplayName(user);
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
};

export function MentionAutocomplete({
  users,
  onMentionSelect,
  onClose,
  query,
  position,
  className
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Filter and format users based on query
  const filteredUsers: MentionUser[] = users
    .map(user => ({
      ...user,
      display_name: getUserDisplayName(user),
      initials: getUserInitials(user)
    }))
    .filter(user => {
      if (!query.trim()) return true;
      const searchQuery = query.toLowerCase();
      return user.display_name.toLowerCase().includes(searchQuery) ||
             user.email.toLowerCase().includes(searchQuery);
    })
    .slice(0, 10); // Limit to 10 results

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onMentionSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredUsers, selectedIndex, onMentionSelect, onClose]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filteredUsers.length === 0) {
    return (
      <Card 
        ref={containerRef}
        className={cn(
          'absolute z-50 w-64 shadow-lg',
          className
        )}
        style={{
          top: position.top,
          left: position.left
        }}
      >
        <CardContent className="p-3">
          <div className="text-sm text-muted-foreground text-center">
            {query ? `No users found for "${query}"` : 'No users available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      ref={containerRef}
      className={cn(
        'absolute z-50 w-64 shadow-lg',
        className
      )}
      style={{
        top: position.top,
        left: position.left
      }}
    >
      <CardContent className="p-1">
        <ScrollArea className="max-h-60">
          <div className="space-y-1">
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                ref={index === selectedIndex ? selectedItemRef : null}
                className={cn(
                  'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                  index === selectedIndex 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                )}
                onClick={() => onMentionSelect(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.raw_user_meta_data?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {user.display_name}
                  </div>
                  <div className={cn(
                    'text-xs truncate',
                    index === selectedIndex 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  )}>
                    {user.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="border-t mt-1 pt-1 px-2 pb-1">
          <div className="text-xs text-muted-foreground">
            ↑↓ navigate • ↵ select • esc cancel
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for managing mention state
export function useMentionAutocomplete() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState(0);

  const openMention = useCallback((query: string, position: { top: number; left: number }, startIndex: number) => {
    setQuery(query);
    setPosition(position);
    setMentionStart(startIndex);
    setIsOpen(true);
  }, []);

  const closeMention = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setPosition({ top: 0, left: 0 });
    setMentionStart(0);
  }, []);

  return {
    isOpen,
    query,
    position,
    mentionStart,
    openMention,
    closeMention
  };
}

// Utility function to detect mentions in text
export function detectMentionAtCursor(
  text: string, 
  cursorPosition: number
): { query: string; startIndex: number } | null {
  // Find the last @ symbol before the cursor
  let atIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    if (text[i] === '@') {
      atIndex = i;
      break;
    }
    // Stop at whitespace or newline
    if (text[i] === ' ' || text[i] === '\n') {
      break;
    }
  }

  if (atIndex === -1) return null;

  // Check if @ is at start or preceded by whitespace
  if (atIndex > 0 && text[atIndex - 1] !== ' ' && text[atIndex - 1] !== '\n') {
    return null;
  }

  // Extract query from @ to cursor
  const query = text.substring(atIndex + 1, cursorPosition);
  
  // Check if query contains whitespace (invalid mention)
  if (query.includes(' ') || query.includes('\n')) {
    return null;
  }

  return {
    query,
    startIndex: atIndex
  };
}

// Utility function to replace mention with formatted text
export function replaceMentionText(
  text: string,
  startIndex: number,
  endIndex: number,
  user: MentionUser
): string {
  const before = text.substring(0, startIndex);
  const after = text.substring(endIndex);
  return `${before}@${user.display_name} ${after}`;
}

// Utility function to extract mentioned user IDs from text
export function extractMentionedUserIds(text: string, users: User[]): string[] {
  const mentionPattern = /@([^\s]+)/g;
  const mentions = [];
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    const mentionText = match[1];
    // Find user by display name
    const user = users.find(u => getUserDisplayName(u) === mentionText);
    if (user) {
      mentions.push(user.id);
    }
  }

  return mentions;
}

// Utility function to highlight mentions in text for display
export function highlightMentions(text: string): React.ReactNode[] {
  const mentionPattern = /@([^\s]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add highlighted mention
    parts.push(
      <span 
        key={`mention-${match.index}`}
        className="bg-primary/10 text-primary px-1 rounded font-medium"
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
