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
          if (filteredUsers[selectedIndex]) {\n            onMentionSelect(filteredUsers[selectedIndex]);\n          }\n          break;\n        case 'Escape':\n          e.preventDefault();\n          onClose();\n          break;\n      }\n    };\n\n    document.addEventListener('keydown', handleKeyDown);\n    return () => document.removeEventListener('keydown', handleKeyDown);\n  }, [filteredUsers, selectedIndex, onMentionSelect, onClose]);\n\n  // Handle click outside to close\n  useEffect(() => {\n    const handleClickOutside = (e: MouseEvent) => {\n      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {\n        onClose();\n      }\n    };\n\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, [onClose]);\n\n  if (filteredUsers.length === 0) {\n    return (\n      <Card \n        ref={containerRef}\n        className={cn(\n          'absolute z-50 w-64 shadow-lg',\n          className\n        )}\n        style={{\n          top: position.top,\n          left: position.left\n        }}\n      >\n        <CardContent className=\"p-3\">\n          <div className=\"text-sm text-muted-foreground text-center\">\n            {query ? `No users found for \"${query}\"` : 'No users available'}\n          </div>\n        </CardContent>\n      </Card>\n    );\n  }\n\n  return (\n    <Card \n      ref={containerRef}\n      className={cn(\n        'absolute z-50 w-64 shadow-lg',\n        className\n      )}\n      style={{\n        top: position.top,\n        left: position.left\n      }}\n    >\n      <CardContent className=\"p-1\">\n        <ScrollArea className=\"max-h-60\">\n          <div className=\"space-y-1\">\n            {filteredUsers.map((user, index) => (\n              <div\n                key={user.id}\n                ref={index === selectedIndex ? selectedItemRef : null}\n                className={cn(\n                  'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',\n                  index === selectedIndex \n                    ? 'bg-primary text-primary-foreground' \n                    : 'hover:bg-muted'\n                )}\n                onClick={() => onMentionSelect(user)}\n                onMouseEnter={() => setSelectedIndex(index)}\n              >\n                <Avatar className=\"h-6 w-6\">\n                  <AvatarImage src={user.raw_user_meta_data?.avatar_url} />\n                  <AvatarFallback className=\"text-xs\">\n                    {user.initials}\n                  </AvatarFallback>\n                </Avatar>\n                \n                <div className=\"flex-1 min-w-0\">\n                  <div className=\"text-sm font-medium truncate\">\n                    {user.display_name}\n                  </div>\n                  <div className={cn(\n                    'text-xs truncate',\n                    index === selectedIndex \n                      ? 'text-primary-foreground/70' \n                      : 'text-muted-foreground'\n                  )}>\n                    {user.email}\n                  </div>\n                </div>\n              </div>\n            ))}\n          </div>\n        </ScrollArea>\n        \n        <div className=\"border-t mt-1 pt-1 px-2 pb-1\">\n          <div className=\"text-xs text-muted-foreground\">\n            ↑↓ navigate • ↵ select • esc cancel\n          </div>\n        </div>\n      </CardContent>\n    </Card>\n  );\n}\n\n// Hook for managing mention state\nexport function useMentionAutocomplete() {\n  const [isOpen, setIsOpen] = useState(false);\n  const [query, setQuery] = useState('');\n  const [position, setPosition] = useState({ top: 0, left: 0 });\n  const [mentionStart, setMentionStart] = useState(0);\n\n  const openMention = useCallback((query: string, position: { top: number; left: number }, startIndex: number) => {\n    setQuery(query);\n    setPosition(position);\n    setMentionStart(startIndex);\n    setIsOpen(true);\n  }, []);\n\n  const closeMention = useCallback(() => {\n    setIsOpen(false);\n    setQuery('');\n    setPosition({ top: 0, left: 0 });\n    setMentionStart(0);\n  }, []);\n\n  return {\n    isOpen,\n    query,\n    position,\n    mentionStart,\n    openMention,\n    closeMention\n  };\n}\n\n// Utility function to detect mentions in text\nexport function detectMentionAtCursor(\n  text: string, \n  cursorPosition: number\n): { query: string; startIndex: number } | null {\n  // Find the last @ symbol before the cursor\n  let atIndex = -1;\n  for (let i = cursorPosition - 1; i >= 0; i--) {\n    if (text[i] === '@') {\n      atIndex = i;\n      break;\n    }\n    // Stop at whitespace or newline\n    if (text[i] === ' ' || text[i] === '\\n') {\n      break;\n    }\n  }\n\n  if (atIndex === -1) return null;\n\n  // Check if @ is at start or preceded by whitespace\n  if (atIndex > 0 && text[atIndex - 1] !== ' ' && text[atIndex - 1] !== '\\n') {\n    return null;\n  }\n\n  // Extract query from @ to cursor\n  const query = text.substring(atIndex + 1, cursorPosition);\n  \n  // Check if query contains whitespace (invalid mention)\n  if (query.includes(' ') || query.includes('\\n')) {\n    return null;\n  }\n\n  return {\n    query,\n    startIndex: atIndex\n  };\n}\n\n// Utility function to replace mention with formatted text\nexport function replaceMentionText(\n  text: string,\n  startIndex: number,\n  endIndex: number,\n  user: MentionUser\n): string {\n  const before = text.substring(0, startIndex);\n  const after = text.substring(endIndex);\n  return `${before}@${user.display_name} ${after}`;\n}\n\n// Utility function to extract mentioned user IDs from text\nexport function extractMentionedUserIds(text: string, users: User[]): string[] {\n  const mentionPattern = /@([^\\s]+)/g;\n  const mentions = [];\n  let match;\n\n  while ((match = mentionPattern.exec(text)) !== null) {\n    const mentionText = match[1];\n    // Find user by display name\n    const user = users.find(u => getUserDisplayName(u) === mentionText);\n    if (user) {\n      mentions.push(user.id);\n    }\n  }\n\n  return mentions;\n}\n\n// Utility function to highlight mentions in text for display\nexport function highlightMentions(text: string): React.ReactNode[] {\n  const mentionPattern = /@([^\\s]+)/g;\n  const parts = [];\n  let lastIndex = 0;\n  let match;\n\n  while ((match = mentionPattern.exec(text)) !== null) {\n    // Add text before mention\n    if (match.index > lastIndex) {\n      parts.push(text.substring(lastIndex, match.index));\n    }\n\n    // Add highlighted mention\n    parts.push(\n      <span \n        key={`mention-${match.index}`}\n        className=\"bg-primary/10 text-primary px-1 rounded font-medium\"\n      >\n        {match[0]}\n      </span>\n    );\n\n    lastIndex = match.index + match[0].length;\n  }\n\n  // Add remaining text\n  if (lastIndex < text.length) {\n    parts.push(text.substring(lastIndex));\n  }\n\n  return parts;\n}