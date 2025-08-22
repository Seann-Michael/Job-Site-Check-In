import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Search, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Emoji {
  emoji: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: Emoji[];
}

const emojiCategories: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile', 'grin'] },
      { emoji: '😁', name: 'beaming face with smiling eyes', keywords: ['happy', 'smile', 'grin'] },
      { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'cry', 'happy'] },
      { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['laugh', 'rofl'] },
      { emoji: '😃', name: 'grinning face with big eyes', keywords: ['happy', 'smile'] },
      { emoji: '😄', name: 'grinning face with smiling eyes', keywords: ['happy', 'smile'] },
      { emoji: '😅', name: 'grinning face with sweat', keywords: ['nervous', 'laugh'] },
      { emoji: '😆', name: 'grinning squinting face', keywords: ['laugh', 'happy'] },
      { emoji: '😉', name: 'winking face', keywords: ['wink', 'flirt'] },
      { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['happy', 'smile'] },
      { emoji: '😋', name: 'face savoring food', keywords: ['yum', 'delicious'] },
      { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'awesome'] },
      { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love', 'heart'] },
      { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'heart'] },
      { emoji: '😘', name: 'face blowing a kiss', keywords: ['kiss', 'love'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'love'] },
      { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm'] },
      { emoji: '😐', name: 'neutral face', keywords: ['neutral', 'meh'] },
      { emoji: '😑', name: 'expressionless face', keywords: ['neutral', 'blank'] },
      { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eye roll', 'annoyed'] },
      { emoji: '😏', name: 'smirking face', keywords: ['smirk', 'sly'] },
      { emoji: '😴', name: 'sleeping face', keywords: ['sleep', 'tired'] },
      { emoji: '😭', name: 'loudly crying face', keywords: ['cry', 'sad'] },
      { emoji: '😢', name: 'crying face', keywords: ['cry', 'sad'] },
      { emoji: '😤', name: 'face with steam from nose', keywords: ['angry', 'mad'] },
      { emoji: '😠', name: 'angry face', keywords: ['angry', 'mad'] },
      { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad'] },
      { emoji: '🤬', name: 'face with symbols on mouth', keywords: ['swear', 'angry'] },
      { emoji: '😱', name: 'face screaming in fear', keywords: ['scared', 'shock'] },
      { emoji: '😨', name: 'fearful face', keywords: ['scared', 'fear'] },
      { emoji: '😰', name: 'anxious face with sweat', keywords: ['nervous', 'anxious'] },
      { emoji: '😥', name: 'sad but relieved face', keywords: ['sad', 'relief'] },
      { emoji: '😓', name: 'downcast face with sweat', keywords: ['tired', 'sad'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'support'] },
      { emoji: '🤭', name: 'face with hand over mouth', keywords: ['oops', 'secret'] },
      { emoji: '🤫', name: 'shushing face', keywords: ['quiet', 'secret'] },
      { emoji: '🤐', name: 'zipper-mouth face', keywords: ['quiet', 'secret'] },
    ]
  },
  {
    id: 'gestures',
    name: 'People & Body',
    icon: '👋',
    emojis: [
      { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'goodbye'] },
      { emoji: '🤚', name: 'raised back of hand', keywords: ['hand', 'stop'] },
      { emoji: '🖐️', name: 'raised hand with fingers splayed', keywords: ['hand', 'five'] },
      { emoji: '✋', name: 'raised hand', keywords: ['hand', 'stop'] },
      { emoji: '🖖', name: 'vulcan salute', keywords: ['spock', 'star trek'] },
      { emoji: '👌', name: 'OK hand', keywords: ['ok', 'good'] },
      { emoji: '🤌', name: 'pinched fingers', keywords: ['italian', 'gesture'] },
      { emoji: '🤏', name: 'pinching hand', keywords: ['small', 'tiny'] },
      { emoji: '✌️', name: 'victory hand', keywords: ['peace', 'victory'] },
      { emoji: '🤞', name: 'crossed fingers', keywords: ['luck', 'hope'] },
      { emoji: '🤟', name: 'love-you gesture', keywords: ['love', 'you'] },
      { emoji: '🤘', name: 'sign of the horns', keywords: ['rock', 'metal'] },
      { emoji: '🤙', name: 'call me hand', keywords: ['call', 'phone'] },
      { emoji: '👈', name: 'backhand index pointing left', keywords: ['left', 'point'] },
      { emoji: '👉', name: 'backhand index pointing right', keywords: ['right', 'point'] },
      { emoji: '👆', name: 'backhand index pointing up', keywords: ['up', 'point'] },
      { emoji: '🖕', name: 'middle finger', keywords: ['middle', 'finger'] },
      { emoji: '👇', name: 'backhand index pointing down', keywords: ['down', 'point'] },
      { emoji: '☝️', name: 'index pointing up', keywords: ['up', 'point'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['good', 'yes', 'like'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['bad', 'no', 'dislike'] },
      { emoji: '✊', name: 'raised fist', keywords: ['fist', 'power'] },
      { emoji: '👊', name: 'oncoming fist', keywords: ['punch', 'fist'] },
      { emoji: '🤛', name: 'left-facing fist', keywords: ['fist', 'bump'] },
      { emoji: '🤜', name: 'right-facing fist', keywords: ['fist', 'bump'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['praise', 'celebration'] },
      { emoji: '👐', name: 'open hands', keywords: ['open', 'hug'] },
      { emoji: '🤲', name: 'palms up together', keywords: ['pray', 'please'] },
      { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agreement'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'thanks'] },
    ]
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      { emoji: '🐶', name: 'dog face', keywords: ['dog', 'pet'] },
      { emoji: '🐱', name: 'cat face', keywords: ['cat', 'pet'] },
      { emoji: '🐭', name: 'mouse face', keywords: ['mouse'] },
      { emoji: '🐹', name: 'hamster', keywords: ['hamster', 'pet'] },
      { emoji: '🐰', name: 'rabbit face', keywords: ['rabbit', 'bunny'] },
      { emoji: '🦊', name: 'fox', keywords: ['fox'] },
      { emoji: '🐻', name: 'bear', keywords: ['bear'] },
      { emoji: '🐼', name: 'panda', keywords: ['panda'] },
      { emoji: '🐨', name: 'koala', keywords: ['koala'] },
      { emoji: '🐯', name: 'tiger face', keywords: ['tiger'] },
      { emoji: '🦁', name: 'lion', keywords: ['lion'] },
      { emoji: '🐮', name: 'cow face', keywords: ['cow'] },
      { emoji: '🐷', name: 'pig face', keywords: ['pig'] },
      { emoji: '🐸', name: 'frog', keywords: ['frog'] },
      { emoji: '🐵', name: 'monkey face', keywords: ['monkey'] },
      { emoji: '🙈', name: 'see-no-evil monkey', keywords: ['monkey', 'eyes'] },
      { emoji: '🙉', name: 'hear-no-evil monkey', keywords: ['monkey', 'ears'] },
      { emoji: '🙊', name: 'speak-no-evil monkey', keywords: ['monkey', 'mouth'] },
      { emoji: '🐔', name: 'chicken', keywords: ['chicken'] },
      { emoji: '🐧', name: 'penguin', keywords: ['penguin'] },
      { emoji: '🐦', name: 'bird', keywords: ['bird'] },
      { emoji: '🐤', name: 'baby chick', keywords: ['chick', 'baby'] },
      { emoji: '🐣', name: 'hatching chick', keywords: ['chick', 'baby'] },
      { emoji: '🐥', name: 'front-facing baby chick', keywords: ['chick', 'baby'] },
      { emoji: '🦆', name: 'duck', keywords: ['duck'] },
      { emoji: '🦅', name: 'eagle', keywords: ['eagle'] },
      { emoji: '🦉', name: 'owl', keywords: ['owl'] },
      { emoji: '🦇', name: 'bat', keywords: ['bat'] },
      { emoji: '🐺', name: 'wolf', keywords: ['wolf'] },
      { emoji: '🐗', name: 'boar', keywords: ['boar'] },
      { emoji: '🐴', name: 'horse face', keywords: ['horse'] },
      { emoji: '🦄', name: 'unicorn', keywords: ['unicorn', 'magic'] },
      { emoji: '🌳', name: 'deciduous tree', keywords: ['tree', 'nature'] },
      { emoji: '🌲', name: 'evergreen tree', keywords: ['tree', 'nature'] },
      { emoji: '🌴', name: 'palm tree', keywords: ['tree', 'tropical'] },
      { emoji: '🌺', name: 'hibiscus', keywords: ['flower'] },
      { emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring'] },
      { emoji: '🌼', name: 'daisy', keywords: ['flower'] },
      { emoji: '🌻', name: 'sunflower', keywords: ['flower', 'sun'] },
      { emoji: '🌹', name: 'rose', keywords: ['flower', 'love'] },
      { emoji: '🌷', name: 'tulip', keywords: ['flower'] },
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍎',
    emojis: [
      { emoji: '🍎', name: 'red apple', keywords: ['apple', 'fruit'] },
      { emoji: '🍊', name: 'tangerine', keywords: ['orange', 'fruit'] },
      { emoji: '🍌', name: 'banana', keywords: ['banana', 'fruit'] },
      { emoji: '🍉', name: 'watermelon', keywords: ['watermelon', 'fruit'] },
      { emoji: '🍇', name: 'grapes', keywords: ['grapes', 'fruit'] },
      { emoji: '🍓', name: 'strawberry', keywords: ['strawberry', 'fruit'] },
      { emoji: '🫐', name: 'blueberries', keywords: ['blueberry', 'fruit'] },
      { emoji: '🍈', name: 'melon', keywords: ['melon', 'fruit'] },
      { emoji: '🍒', name: 'cherries', keywords: ['cherry', 'fruit'] },
      { emoji: '🍑', name: 'peach', keywords: ['peach', 'fruit'] },
      { emoji: '🥭', name: 'mango', keywords: ['mango', 'fruit'] },
      { emoji: '🍍', name: 'pineapple', keywords: ['pineapple', 'fruit'] },
      { emoji: '🥥', name: 'coconut', keywords: ['coconut', 'fruit'] },
      { emoji: '🥝', name: 'kiwi fruit', keywords: ['kiwi', 'fruit'] },
      { emoji: '🍅', name: 'tomato', keywords: ['tomato', 'vegetable'] },
      { emoji: '🍆', name: 'eggplant', keywords: ['eggplant', 'vegetable'] },
      { emoji: '🥑', name: 'avocado', keywords: ['avocado', 'fruit'] },
      { emoji: '🥦', name: 'broccoli', keywords: ['broccoli', 'vegetable'] },
      { emoji: '🥬', name: 'leafy greens', keywords: ['lettuce', 'vegetable'] },
      { emoji: '🥒', name: 'cucumber', keywords: ['cucumber', 'vegetable'] },
      { emoji: '🌶️', name: 'hot pepper', keywords: ['pepper', 'spicy'] },
      { emoji: '🥕', name: 'carrot', keywords: ['carrot', 'vegetable'] },
      { emoji: '🧄', name: 'garlic', keywords: ['garlic', 'vegetable'] },
      { emoji: '🧅', name: 'onion', keywords: ['onion', 'vegetable'] },
      { emoji: '🍄', name: 'mushroom', keywords: ['mushroom', 'vegetable'] },
      { emoji: '🥜', name: 'peanuts', keywords: ['peanut', 'nut'] },
      { emoji: '🌰', name: 'chestnut', keywords: ['chestnut', 'nut'] },
      { emoji: '🍞', name: 'bread', keywords: ['bread'] },
      { emoji: '🥐', name: 'croissant', keywords: ['croissant', 'bread'] },
      { emoji: '🥖', name: 'baguette bread', keywords: ['baguette', 'bread'] },
      { emoji: '🫓', name: 'flatbread', keywords: ['flatbread', 'bread'] },
      { emoji: '🥨', name: 'pretzel', keywords: ['pretzel'] },
      { emoji: '🥯', name: 'bagel', keywords: ['bagel'] },
      { emoji: '🥞', name: 'pancakes', keywords: ['pancake', 'breakfast'] },
      { emoji: '🧇', name: 'waffle', keywords: ['waffle', 'breakfast'] },
      { emoji: '🧀', name: 'cheese wedge', keywords: ['cheese'] },
      { emoji: '🍖', name: 'meat on bone', keywords: ['meat'] },
      { emoji: '🍗', name: 'poultry leg', keywords: ['chicken', 'meat'] },
      { emoji: '🥩', name: 'cut of meat', keywords: ['steak', 'meat'] },
      { emoji: '🥓', name: 'bacon', keywords: ['bacon', 'meat'] },
      { emoji: '🍔', name: 'hamburger', keywords: ['burger', 'food'] },
      { emoji: '🍟', name: 'french fries', keywords: ['fries', 'food'] },
      { emoji: '🍕', name: 'pizza', keywords: ['pizza', 'food'] },
      { emoji: '🌭', name: 'hot dog', keywords: ['hot dog', 'food'] },
      { emoji: '🥪', name: 'sandwich', keywords: ['sandwich', 'food'] },
      { emoji: '🌮', name: 'taco', keywords: ['taco', 'food'] },
      { emoji: '🌯', name: 'burrito', keywords: ['burrito', 'food'] },
      { emoji: '🫔', name: 'tamale', keywords: ['tamale', 'food'] },
      { emoji: '🥙', name: 'stuffed flatbread', keywords: ['pita', 'food'] },
      { emoji: '🧆', name: 'falafel', keywords: ['falafel', 'food'] },
      { emoji: '🥚', name: 'egg', keywords: ['egg', 'food'] },
      { emoji: '🍳', name: 'cooking', keywords: ['cooking', 'egg'] },
      { emoji: '🥘', name: 'shallow pan of food', keywords: ['paella', 'food'] },
      { emoji: '🍲', name: 'pot of food', keywords: ['stew', 'soup'] },
      { emoji: '🫕', name: 'fondue', keywords: ['fondue', 'food'] },
      { emoji: '🥣', name: 'bowl with spoon', keywords: ['bowl', 'cereal'] },
      { emoji: '🥗', name: 'green salad', keywords: ['salad', 'healthy'] },
      { emoji: '🍿', name: 'popcorn', keywords: ['popcorn', 'snack'] },
      { emoji: '🧈', name: 'butter', keywords: ['butter'] },
      { emoji: '🧂', name: 'salt', keywords: ['salt'] },
      { emoji: '🥫', name: 'canned food', keywords: ['can', 'food'] },
      { emoji: '☕', name: 'hot beverage', keywords: ['coffee', 'tea'] },
      { emoji: '🍵', name: 'teacup without handle', keywords: ['tea'] },
      { emoji: '🧃', name: 'beverage box', keywords: ['juice', 'drink'] },
      { emoji: '🥤', name: 'cup with straw', keywords: ['soda', 'drink'] },
      { emoji: '🧋', name: 'bubble tea', keywords: ['boba', 'tea'] },
      { emoji: '🍶', name: 'sake', keywords: ['sake', 'alcohol'] },
      { emoji: '🍺', name: 'beer mug', keywords: ['beer', 'alcohol'] },
      { emoji: '🍻', name: 'clinking beer mugs', keywords: ['beer', 'cheers'] },
      { emoji: '🥂', name: 'clinking glasses', keywords: ['cheers', 'celebration'] },
      { emoji: '🍷', name: 'wine glass', keywords: ['wine', 'alcohol'] },
      { emoji: '🥃', name: 'tumbler glass', keywords: ['whiskey', 'alcohol'] },
      { emoji: '🍸', name: 'cocktail glass', keywords: ['cocktail', 'alcohol'] },
      { emoji: '🍹', name: 'tropical drink', keywords: ['cocktail', 'tropical'] },
      { emoji: '🧊', name: 'ice', keywords: ['ice', 'cold'] },
    ]
  },
  {
    id: 'activity',
    name: 'Activities',
    icon: '⚽',
    emojis: [
      { emoji: '⚽', name: 'soccer ball', keywords: ['soccer', 'football', 'sport'] },
      { emoji: '🏀', name: 'basketball', keywords: ['basketball', 'sport'] },
      { emoji: '🏈', name: 'american football', keywords: ['football', 'sport'] },
      { emoji: '⚾', name: 'baseball', keywords: ['baseball', 'sport'] },
      { emoji: '🥎', name: 'softball', keywords: ['softball', 'sport'] },
      { emoji: '🎾', name: 'tennis', keywords: ['tennis', 'sport'] },
      { emoji: '🏐', name: 'volleyball', keywords: ['volleyball', 'sport'] },
      { emoji: '🏉', name: 'rugby football', keywords: ['rugby', 'sport'] },
      { emoji: '🥏', name: 'flying disc', keywords: ['frisbee', 'sport'] },
      { emoji: '🎱', name: 'pool 8 ball', keywords: ['billiards', 'pool'] },
      { emoji: '🪀', name: 'yo-yo', keywords: ['yo-yo', 'toy'] },
      { emoji: '🏓', name: 'ping pong', keywords: ['ping pong', 'sport'] },
      { emoji: '🏸', name: 'badminton', keywords: ['badminton', 'sport'] },
      { emoji: '🥅', name: 'goal net', keywords: ['goal', 'sport'] },
      { emoji: '⛳', name: 'flag in hole', keywords: ['golf', 'sport'] },
      { emoji: '🪁', name: 'kite', keywords: ['kite', 'fly'] },
      { emoji: '🏹', name: 'bow and arrow', keywords: ['archery', 'sport'] },
      { emoji: '🎣', name: 'fishing pole', keywords: ['fishing'] },
      { emoji: '🤿', name: 'diving mask', keywords: ['diving', 'snorkel'] },
      { emoji: '🥊', name: 'boxing glove', keywords: ['boxing', 'sport'] },
      { emoji: '🥋', name: 'martial arts uniform', keywords: ['karate', 'martial arts'] },
      { emoji: '🎽', name: 'running shirt', keywords: ['running', 'sport'] },
      { emoji: '🛹', name: 'skateboard', keywords: ['skateboard', 'sport'] },
      { emoji: '🛷', name: 'sled', keywords: ['sled', 'winter'] },
      { emoji: '⛸️', name: 'ice skate', keywords: ['skating', 'ice'] },
      { emoji: '🥌', name: 'curling stone', keywords: ['curling', 'sport'] },
      { emoji: '🎿', name: 'skis', keywords: ['skiing', 'winter'] },
      { emoji: '⛷️', name: 'skier', keywords: ['skiing', 'winter'] },
      { emoji: '🏂', name: 'snowboarder', keywords: ['snowboard', 'winter'] },
      { emoji: '🪂', name: 'parachute', keywords: ['parachute', 'skydiving'] },
      { emoji: '🏋️', name: 'person lifting weights', keywords: ['weightlifting', 'gym'] },
      { emoji: '🤼', name: 'people wrestling', keywords: ['wrestling', 'sport'] },
      { emoji: '🤸', name: 'person cartwheeling', keywords: ['cartwheel', 'gymnastics'] },
      { emoji: '⛹️', name: 'person bouncing ball', keywords: ['basketball', 'sport'] },
      { emoji: '🤺', name: 'person fencing', keywords: ['fencing', 'sport'] },
      { emoji: '🏊', name: 'person swimming', keywords: ['swimming', 'sport'] },
      { emoji: '🏄', name: 'person surfing', keywords: ['surfing', 'sport'] },
      { emoji: '🚣', name: 'person rowing boat', keywords: ['rowing', 'boat'] },
      { emoji: '🧗', name: 'person climbing', keywords: ['climbing', 'sport'] },
      { emoji: '🚵', name: 'person mountain biking', keywords: ['biking', 'sport'] },
      { emoji: '🚴', name: 'person biking', keywords: ['biking', 'sport'] },
      { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'award'] },
      { emoji: '🥇', name: 'first place medal', keywords: ['gold', 'first', 'win'] },
      { emoji: '🥈', name: 'second place medal', keywords: ['silver', 'second'] },
      { emoji: '🥉', name: 'third place medal', keywords: ['bronze', 'third'] },
      { emoji: '🏅', name: 'sports medal', keywords: ['medal', 'award'] },
      { emoji: '🎖️', name: 'military medal', keywords: ['medal', 'military'] },
      { emoji: '🏵️', name: 'rosette', keywords: ['award', 'rosette'] },
      { emoji: '🎗️', name: 'reminder ribbon', keywords: ['ribbon', 'awareness'] },
      { emoji: '🎫', name: 'ticket', keywords: ['ticket', 'event'] },
      { emoji: '🎟️', name: 'admission tickets', keywords: ['tickets', 'event'] },
    ]
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💻',
    emojis: [
      { emoji: '💻', name: 'laptop', keywords: ['computer', 'laptop'] },
      { emoji: '🖥️', name: 'desktop computer', keywords: ['computer', 'desktop'] },
      { emoji: '🖨️', name: 'printer', keywords: ['printer'] },
      { emoji: '⌨️', name: 'keyboard', keywords: ['keyboard'] },
      { emoji: '🖱️', name: 'computer mouse', keywords: ['mouse', 'computer'] },
      { emoji: '🖲️', name: 'trackball', keywords: ['trackball'] },
      { emoji: '💽', name: 'computer disk', keywords: ['disk', 'minidisc'] },
      { emoji: '💾', name: 'floppy disk', keywords: ['floppy', 'disk', 'save'] },
      { emoji: '💿', name: 'optical disk', keywords: ['cd', 'disk'] },
      { emoji: '📀', name: 'dvd', keywords: ['dvd', 'disk'] },
      { emoji: '🧮', name: 'abacus', keywords: ['abacus', 'calculate'] },
      { emoji: '🎥', name: 'movie camera', keywords: ['camera', 'movie'] },
      { emoji: '🎞️', name: 'film frames', keywords: ['film', 'movie'] },
      { emoji: '📽️', name: 'film projector', keywords: ['projector', 'movie'] },
      { emoji: '🎬', name: 'clapper board', keywords: ['movie', 'film'] },
      { emoji: '📺', name: 'television', keywords: ['tv', 'television'] },
      { emoji: '📷', name: 'camera', keywords: ['camera', 'photo'] },
      { emoji: '📸', name: 'camera with flash', keywords: ['camera', 'photo', 'flash'] },
      { emoji: '📹', name: 'video camera', keywords: ['camera', 'video'] },
      { emoji: '📼', name: 'videocassette', keywords: ['vhs', 'video'] },
      { emoji: '🔍', name: 'magnifying glass tilted left', keywords: ['search', 'magnify'] },
      { emoji: '🔎', name: 'magnifying glass tilted right', keywords: ['search', 'magnify'] },
      { emoji: '🕯️', name: 'candle', keywords: ['candle', 'light'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light'] },
      { emoji: '🔦', name: 'flashlight', keywords: ['flashlight', 'light'] },
      { emoji: '🏮', name: 'red paper lantern', keywords: ['lantern', 'light'] },
      { emoji: '🪔', name: 'diya lamp', keywords: ['lamp', 'light'] },
      { emoji: '📔', name: 'notebook with decorative cover', keywords: ['notebook', 'book'] },
      { emoji: '📕', name: 'closed book', keywords: ['book', 'closed'] },
      { emoji: '📖', name: 'open book', keywords: ['book', 'open', 'read'] },
      { emoji: '📗', name: 'green book', keywords: ['book', 'green'] },
      { emoji: '📘', name: 'blue book', keywords: ['book', 'blue'] },
      { emoji: '📙', name: 'orange book', keywords: ['book', 'orange'] },
      { emoji: '📚', name: 'books', keywords: ['books', 'library'] },
      { emoji: '📓', name: 'notebook', keywords: ['notebook'] },
      { emoji: '📒', name: 'ledger', keywords: ['ledger', 'notebook'] },
      { emoji: '📃', name: 'page with curl', keywords: ['page', 'document'] },
      { emoji: '📜', name: 'scroll', keywords: ['scroll', 'document'] },
      { emoji: '📄', name: 'page facing up', keywords: ['page', 'document'] },
      { emoji: '📰', name: 'newspaper', keywords: ['news', 'newspaper'] },
      { emoji: '🗞️', name: 'rolled-up newspaper', keywords: ['news', 'newspaper'] },
      { emoji: '📑', name: 'bookmark tabs', keywords: ['bookmark', 'tabs'] },
      { emoji: '🔖', name: 'bookmark', keywords: ['bookmark'] },
      { emoji: '🏷️', name: 'label', keywords: ['label', 'tag'] },
      { emoji: '💰', name: 'money bag', keywords: ['money', 'bag'] },
      { emoji: '🪙', name: 'coin', keywords: ['coin', 'money'] },
      { emoji: '💴', name: 'yen banknote', keywords: ['yen', 'money'] },
      { emoji: '💵', name: 'dollar banknote', keywords: ['dollar', 'money'] },
      { emoji: '💶', name: 'euro banknote', keywords: ['euro', 'money'] },
      { emoji: '💷', name: 'pound banknote', keywords: ['pound', 'money'] },
      { emoji: '💸', name: 'money with wings', keywords: ['money', 'fly'] },
      { emoji: '💳', name: 'credit card', keywords: ['card', 'credit'] },
      { emoji: '🧾', name: 'receipt', keywords: ['receipt'] },
      { emoji: '💎', name: 'gem stone', keywords: ['gem', 'diamond'] },
      { emoji: '⚖️', name: 'balance scale', keywords: ['scale', 'justice'] },
      { emoji: '🪜', name: 'ladder', keywords: ['ladder'] },
      { emoji: '🧰', name: 'toolbox', keywords: ['toolbox', 'tools'] },
      { emoji: '🔧', name: 'wrench', keywords: ['wrench', 'tool'] },
      { emoji: '🔨', name: 'hammer', keywords: ['hammer', 'tool'] },
      { emoji: '⚒️', name: 'hammer and pick', keywords: ['tools', 'hammer'] },
      { emoji: '🛠️', name: 'hammer and wrench', keywords: ['tools'] },
      { emoji: '⛏️', name: 'pick', keywords: ['pick', 'tool'] },
      { emoji: '🪚', name: 'carpentry saw', keywords: ['saw', 'tool'] },
      { emoji: '🔩', name: 'nut and bolt', keywords: ['nut', 'bolt'] },
      { emoji: '⚙️', name: 'gear', keywords: ['gear', 'settings'] },
      { emoji: '🪤', name: 'mouse trap', keywords: ['trap', 'mouse'] },
      { emoji: '🧲', name: 'magnet', keywords: ['magnet'] },
      { emoji: '🪣', name: 'bucket', keywords: ['bucket'] },
      { emoji: '🧽', name: 'sponge', keywords: ['sponge', 'clean'] },
      { emoji: '🧴', name: 'lotion bottle', keywords: ['bottle', 'lotion'] },
      { emoji: '🧷', name: 'safety pin', keywords: ['pin', 'safety'] },
      { emoji: '🧹', name: 'broom', keywords: ['broom', 'clean'] },
      { emoji: '🧺', name: 'basket', keywords: ['basket'] },
      { emoji: '🪟', name: 'window', keywords: ['window'] },
      { emoji: '🪞', name: 'mirror', keywords: ['mirror'] },
      { emoji: '🛏️', name: 'bed', keywords: ['bed', 'sleep'] },
      { emoji: '🛋️', name: 'couch and lamp', keywords: ['couch', 'sofa'] },
      { emoji: '🪑', name: 'chair', keywords: ['chair'] },
      { emoji: '🚪', name: 'door', keywords: ['door'] },
      { emoji: '🪆', name: 'nesting dolls', keywords: ['dolls', 'russian'] },
      { emoji: '🎎', name: 'Japanese dolls', keywords: ['dolls', 'japanese'] },
      { emoji: '🎏', name: 'carp streamer', keywords: ['koinobori', 'japanese'] },
      { emoji: '🎐', name: 'wind chime', keywords: ['chime', 'wind'] },
      { emoji: '🎁', name: 'wrapped gift', keywords: ['gift', 'present'] },
      { emoji: '🎀', name: 'ribbon', keywords: ['ribbon', 'bow'] },
      { emoji: '🎊', name: 'confetti ball', keywords: ['confetti', 'celebration'] },
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebration'] },
      { emoji: '🪅', name: 'piñata', keywords: ['pinata', 'party'] },
      { emoji: '🪩', name: 'mirror ball', keywords: ['disco', 'ball'] },
      { emoji: '🎈', name: 'balloon', keywords: ['balloon', 'party'] },
      { emoji: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday'] },
      { emoji: '🍰', name: 'shortcake', keywords: ['cake', 'dessert'] },
      { emoji: '🧁', name: 'cupcake', keywords: ['cupcake', 'dessert'] },
      { emoji: '🥧', name: 'pie', keywords: ['pie', 'dessert'] },
      { emoji: '🍫', name: 'chocolate bar', keywords: ['chocolate', 'candy'] },
      { emoji: '🍬', name: 'candy', keywords: ['candy', 'sweet'] },
      { emoji: '🍭', name: 'lollipop', keywords: ['lollipop', 'candy'] },
      { emoji: '🍮', name: 'custard', keywords: ['custard', 'dessert'] },
      { emoji: '🍯', name: 'honey pot', keywords: ['honey', 'pot'] },
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart'] },
      { emoji: '🧡', name: 'orange heart', keywords: ['love', 'heart', 'orange'] },
      { emoji: '💛', name: 'yellow heart', keywords: ['love', 'heart', 'yellow'] },
      { emoji: '💚', name: 'green heart', keywords: ['love', 'heart', 'green'] },
      { emoji: '💙', name: 'blue heart', keywords: ['love', 'heart', 'blue'] },
      { emoji: '💜', name: 'purple heart', keywords: ['love', 'heart', 'purple'] },
      { emoji: '🖤', name: 'black heart', keywords: ['love', 'heart', 'black'] },
      { emoji: '🤍', name: 'white heart', keywords: ['love', 'heart', 'white'] },
      { emoji: '🤎', name: 'brown heart', keywords: ['love', 'heart', 'brown'] },
      { emoji: '💔', name: 'broken heart', keywords: ['broken', 'heart', 'sad'] },
      { emoji: '❣️', name: 'heart exclamation', keywords: ['heart', 'exclamation'] },
      { emoji: '💕', name: 'two hearts', keywords: ['love', 'hearts'] },
      { emoji: '💞', name: 'revolving hearts', keywords: ['love', 'hearts'] },
      { emoji: '💓', name: 'beating heart', keywords: ['love', 'heart', 'beat'] },
      { emoji: '💗', name: 'growing heart', keywords: ['love', 'heart', 'grow'] },
      { emoji: '💖', name: 'sparkling heart', keywords: ['love', 'heart', 'sparkle'] },
      { emoji: '💘', name: 'heart with arrow', keywords: ['love', 'heart', 'arrow'] },
      { emoji: '💝', name: 'heart with ribbon', keywords: ['love', 'heart', 'gift'] },
      { emoji: '💟', name: 'heart decoration', keywords: ['love', 'heart'] },
      { emoji: '☮️', name: 'peace symbol', keywords: ['peace'] },
      { emoji: '✝️', name: 'latin cross', keywords: ['cross', 'christian'] },
      { emoji: '☪️', name: 'star and crescent', keywords: ['islam', 'muslim'] },
      { emoji: '🕉️', name: 'om', keywords: ['om', 'hindu'] },
      { emoji: '☸️', name: 'wheel of dharma', keywords: ['buddhist', 'dharma'] },
      { emoji: '✡️', name: 'star of david', keywords: ['jewish', 'judaism'] },
      { emoji: '🔯', name: 'dotted six-pointed star', keywords: ['star', 'jewish'] },
      { emoji: '🕎', name: 'menorah', keywords: ['menorah', 'jewish'] },
      { emoji: '☯️', name: 'yin yang', keywords: ['yin', 'yang', 'balance'] },
      { emoji: '☦️', name: 'orthodox cross', keywords: ['cross', 'orthodox'] },
      { emoji: '🛐', name: 'place of worship', keywords: ['worship', 'religion'] },
      { emoji: '⛎', name: 'ophiuchus', keywords: ['zodiac', 'ophiuchus'] },
      { emoji: '♈', name: 'aries', keywords: ['zodiac', 'aries'] },
      { emoji: '♉', name: 'taurus', keywords: ['zodiac', 'taurus'] },
      { emoji: '♊', name: 'gemini', keywords: ['zodiac', 'gemini'] },
      { emoji: '♋', name: 'cancer', keywords: ['zodiac', 'cancer'] },
      { emoji: '♌', name: 'leo', keywords: ['zodiac', 'leo'] },
      { emoji: '♍', name: 'virgo', keywords: ['zodiac', 'virgo'] },
      { emoji: '♎', name: 'libra', keywords: ['zodiac', 'libra'] },
      { emoji: '♏', name: 'scorpio', keywords: ['zodiac', 'scorpio'] },
      { emoji: '♐', name: 'sagittarius', keywords: ['zodiac', 'sagittarius'] },
      { emoji: '♑', name: 'capricorn', keywords: ['zodiac', 'capricorn'] },
      { emoji: '♒', name: 'aquarius', keywords: ['zodiac', 'aquarius'] },
      { emoji: '♓', name: 'pisces', keywords: ['zodiac', 'pisces'] },
      { emoji: '🆔', name: 'id button', keywords: ['id', 'identification'] },
      { emoji: '⚛️', name: 'atom symbol', keywords: ['atom', 'science'] },
      { emoji: '🉑', name: 'japanese acceptable button', keywords: ['japanese', 'acceptable'] },
      { emoji: '☢️', name: 'radioactive', keywords: ['radioactive', 'danger'] },
      { emoji: '☣️', name: 'biohazard', keywords: ['biohazard', 'danger'] },
      { emoji: '📴', name: 'mobile phone off', keywords: ['phone', 'off'] },
      { emoji: '📳', name: 'vibration mode', keywords: ['phone', 'vibrate'] },
      { emoji: '🈶', name: 'japanese not free of charge button', keywords: ['japanese', 'charge'] },
      { emoji: '🈚', name: 'japanese free of charge button', keywords: ['japanese', 'free'] },
      { emoji: '🈸', name: 'japanese application button', keywords: ['japanese', 'application'] },
      { emoji: '🈺', name: 'japanese open for business button', keywords: ['japanese', 'open'] },
      { emoji: '🈷️', name: 'japanese monthly amount button', keywords: ['japanese', 'monthly'] },
      { emoji: '✴️', name: 'eight-pointed star', keywords: ['star'] },
      { emoji: '🆚', name: 'vs button', keywords: ['vs', 'versus'] },
      { emoji: '💮', name: 'white flower', keywords: ['flower', 'white'] },
      { emoji: '🉐', name: 'japanese bargain button', keywords: ['japanese', 'bargain'] },
      { emoji: '㊙️', name: 'japanese secret button', keywords: ['japanese', 'secret'] },
      { emoji: '㊗️', name: 'japanese congratulations button', keywords: ['japanese', 'congratulations'] },
      { emoji: '🈴', name: 'japanese passing grade button', keywords: ['japanese', 'passing'] },
      { emoji: '🈵', name: 'japanese no vacancy button', keywords: ['japanese', 'no vacancy'] },
      { emoji: '🈹', name: 'japanese discount button', keywords: ['japanese', 'discount'] },
      { emoji: '🈲', name: 'japanese prohibited button', keywords: ['japanese', 'prohibited'] },
      { emoji: '🅰️', name: 'a button', keywords: ['a', 'button'] },
      { emoji: '🅱️', name: 'b button', keywords: ['b', 'button'] },
      { emoji: '🆎', name: 'ab button', keywords: ['ab', 'button'] },
      { emoji: '🆑', name: 'cl button', keywords: ['cl', 'button'] },
      { emoji: '🅾️', name: 'o button', keywords: ['o', 'button'] },
      { emoji: '🆘', name: 'sos button', keywords: ['sos', 'emergency'] },
      { emoji: '❌', name: 'cross mark', keywords: ['x', 'cross', 'no'] },
      { emoji: '⭕', name: 'heavy large circle', keywords: ['o', 'circle', 'yes'] },
      { emoji: '🛑', name: 'stop sign', keywords: ['stop', 'sign'] },
      { emoji: '⛔', name: 'no entry', keywords: ['no', 'entry'] },
      { emoji: '📛', name: 'name badge', keywords: ['name', 'badge'] },
      { emoji: '🚫', name: 'prohibited', keywords: ['no', 'prohibited'] },
      { emoji: '💯', name: 'hundred points', keywords: ['100', 'perfect'] },
      { emoji: '💢', name: 'anger symbol', keywords: ['anger', 'mad'] },
      { emoji: '♨️', name: 'hot springs', keywords: ['hot', 'springs'] },
      { emoji: '🚷', name: 'no pedestrians', keywords: ['no', 'pedestrians'] },
      { emoji: '🚯', name: 'no littering', keywords: ['no', 'littering'] },
      { emoji: '🚳', name: 'no bicycles', keywords: ['no', 'bicycles'] },
      { emoji: '🚱', name: 'non-potable water', keywords: ['no', 'water'] },
      { emoji: '🔞', name: 'no one under eighteen', keywords: ['18', 'adult'] },
      { emoji: '📵', name: 'no mobile phones', keywords: ['no', 'phone'] },
      { emoji: '🚭', name: 'no smoking', keywords: ['no', 'smoking'] },
      { emoji: '❗', name: 'exclamation mark', keywords: ['exclamation', '!'] },
      { emoji: '❕', name: 'white exclamation mark', keywords: ['exclamation', '!'] },
      { emoji: '❓', name: 'question mark', keywords: ['question', '?'] },
      { emoji: '❔', name: 'white question mark', keywords: ['question', '?'] },
      { emoji: '‼️', name: 'double exclamation mark', keywords: ['exclamation', '!!'] },
      { emoji: '⁉️', name: 'exclamation question mark', keywords: ['exclamation', 'question'] },
      { emoji: '🔅', name: 'dim button', keywords: ['dim', 'brightness'] },
      { emoji: '🔆', name: 'bright button', keywords: ['bright', 'brightness'] },
      { emoji: '〽️', name: 'part alternation mark', keywords: ['part', 'alternation'] },
      { emoji: '⚠️', name: 'warning', keywords: ['warning', 'caution'] },
      { emoji: '🚸', name: 'children crossing', keywords: ['children', 'crossing'] },
      { emoji: '🔱', name: 'trident emblem', keywords: ['trident'] },
      { emoji: '⚜️', name: 'fleur-de-lis', keywords: ['fleur-de-lis'] },
      { emoji: '🔰', name: 'japanese symbol for beginner', keywords: ['beginner', 'japanese'] },
      { emoji: '♻️', name: 'recycling symbol', keywords: ['recycle'] },
      { emoji: '✅', name: 'check mark button', keywords: ['check', 'mark'] },
      { emoji: '🈯', name: 'japanese reserved button', keywords: ['japanese', 'reserved'] },
      { emoji: '💹', name: 'chart increasing with yen', keywords: ['chart', 'yen'] },
      { emoji: '❇️', name: 'sparkle', keywords: ['sparkle'] },
      { emoji: '✳️', name: 'eight-spoked asterisk', keywords: ['asterisk'] },
      { emoji: '❎', name: 'cross mark button', keywords: ['x', 'cross'] },
      { emoji: '🌐', name: 'globe with meridians', keywords: ['globe', 'world'] },
      { emoji: '💠', name: 'diamond with a dot', keywords: ['diamond', 'dot'] },
      { emoji: 'Ⓜ️', name: 'm button', keywords: ['m', 'button'] },
      { emoji: '🌀', name: 'cyclone', keywords: ['cyclone', 'spiral'] },
      { emoji: '💤', name: 'zzz', keywords: ['sleep', 'zzz'] },
      { emoji: '🏧', name: 'atm sign', keywords: ['atm', 'bank'] },
      { emoji: '🚾', name: 'water closet', keywords: ['toilet', 'wc'] },
      { emoji: '♿', name: 'wheelchair symbol', keywords: ['wheelchair', 'accessibility'] },
      { emoji: '🅿️', name: 'p button', keywords: ['p', 'parking'] },
      { emoji: '🈳', name: 'japanese vacancy button', keywords: ['japanese', 'vacancy'] },
      { emoji: '🈂️', name: 'japanese service charge button', keywords: ['japanese', 'service'] },
      { emoji: '🛂', name: 'passport control', keywords: ['passport', 'control'] },
      { emoji: '🛃', name: 'customs', keywords: ['customs'] },
      { emoji: '🛄', name: 'baggage claim', keywords: ['baggage', 'claim'] },
      { emoji: '🛅', name: 'left luggage', keywords: ['luggage', 'left'] },
      { emoji: '🚹', name: 'men\'s room', keywords: ['men', 'toilet'] },
      { emoji: '🚺', name: 'women\'s room', keywords: ['women', 'toilet'] },
      { emoji: '🚼', name: 'baby symbol', keywords: ['baby'] },
      { emoji: '🚻', name: 'restroom', keywords: ['restroom', 'toilet'] },
      { emoji: '🚮', name: 'litter in bin sign', keywords: ['litter', 'bin'] },
      { emoji: '🎦', name: 'cinema', keywords: ['cinema', 'movie'] },
      { emoji: '📶', name: 'antenna bars', keywords: ['signal', 'bars'] },
      { emoji: '🈁', name: 'japanese here button', keywords: ['japanese', 'here'] },
      { emoji: '🔣', name: 'input symbols', keywords: ['symbols', 'input'] },
      { emoji: 'ℹ️', name: 'information', keywords: ['information', 'i'] },
      { emoji: '🔤', name: 'input latin letters', keywords: ['letters', 'abc'] },
      { emoji: '🔡', name: 'input latin lowercase', keywords: ['lowercase', 'abc'] },
      { emoji: '🔠', name: 'input latin uppercase', keywords: ['uppercase', 'ABC'] },
      { emoji: '🔢', name: 'input numbers', keywords: ['numbers', '123'] },
      { emoji: '#️⃣', name: 'keycap number sign', keywords: ['#', 'hash'] },
      { emoji: '*️⃣', name: 'keycap asterisk', keywords: ['*', 'asterisk'] },
      { emoji: '⏏️', name: 'eject button', keywords: ['eject'] },
      { emoji: '▶️', name: 'play button', keywords: ['play'] },
      { emoji: '⏸️', name: 'pause button', keywords: ['pause'] },
      { emoji: '⏯️', name: 'play or pause button', keywords: ['play', 'pause'] },
      { emoji: '⏹️', name: 'stop button', keywords: ['stop'] },
      { emoji: '⏺️', name: 'record button', keywords: ['record'] },
      { emoji: '⏭️', name: 'next track button', keywords: ['next', 'track'] },
      { emoji: '⏮️', name: 'last track button', keywords: ['previous', 'track'] },
      { emoji: '⏩', name: 'fast-forward button', keywords: ['fast', 'forward'] },
      { emoji: '⏪', name: 'fast reverse button', keywords: ['fast', 'reverse'] },
      { emoji: '⏫', name: 'fast up button', keywords: ['fast', 'up'] },
      { emoji: '⏬', name: 'fast down button', keywords: ['fast', 'down'] },
      { emoji: '◀️', name: 'reverse button', keywords: ['reverse', 'left'] },
      { emoji: '🔼', name: 'upwards button', keywords: ['up', 'triangle'] },
      { emoji: '🔽', name: 'downwards button', keywords: ['down', 'triangle'] },
      { emoji: '➡️', name: 'right arrow', keywords: ['right', 'arrow'] },
      { emoji: '⬅️', name: 'left arrow', keywords: ['left', 'arrow'] },
      { emoji: '⬆️', name: 'up arrow', keywords: ['up', 'arrow'] },
      { emoji: '⬇️', name: 'down arrow', keywords: ['down', 'arrow'] },
      { emoji: '↗️', name: 'up-right arrow', keywords: ['up', 'right', 'arrow'] },
      { emoji: '↘️', name: 'down-right arrow', keywords: ['down', 'right', 'arrow'] },
      { emoji: '↙️', name: 'down-left arrow', keywords: ['down', 'left', 'arrow'] },
      { emoji: '↖️', name: 'up-left arrow', keywords: ['up', 'left', 'arrow'] },
      { emoji: '↕️', name: 'up-down arrow', keywords: ['up', 'down', 'arrow'] },
      { emoji: '↔️', name: 'left-right arrow', keywords: ['left', 'right', 'arrow'] },
      { emoji: '↩️', name: 'right arrow curving left', keywords: ['return', 'arrow'] },
      { emoji: '↪️', name: 'left arrow curving right', keywords: ['arrow'] },
      { emoji: '⤴️', name: 'right arrow curving up', keywords: ['arrow', 'up'] },
      { emoji: '⤵️', name: 'right arrow curving down', keywords: ['arrow', 'down'] },
      { emoji: '🔀', name: 'twisted rightwards arrows', keywords: ['shuffle', 'random'] },
      { emoji: '🔁', name: 'repeat button', keywords: ['repeat', 'loop'] },
      { emoji: '🔂', name: 'repeat single button', keywords: ['repeat', 'single'] },
      { emoji: '🔄', name: 'counterclockwise arrows button', keywords: ['refresh', 'reload'] },
      { emoji: '🔃', name: 'clockwise vertical arrows', keywords: ['reload'] },
      { emoji: '🎵', name: 'musical note', keywords: ['music', 'note'] },
      { emoji: '🎶', name: 'musical notes', keywords: ['music', 'notes'] },
      { emoji: '➕', name: 'plus', keywords: ['plus', '+'] },
      { emoji: '➖', name: 'minus', keywords: ['minus', '-'] },
      { emoji: '➗', name: 'divide', keywords: ['divide', '÷'] },
      { emoji: '✖️', name: 'multiply', keywords: ['multiply', '×'] },
      { emoji: '♾️', name: 'infinity', keywords: ['infinity', '∞'] },
      { emoji: '💲', name: 'heavy dollar sign', keywords: ['dollar', '$'] },
      { emoji: '💱', name: 'currency exchange', keywords: ['currency', 'exchange'] },
      { emoji: '™️', name: 'trade mark', keywords: ['trademark', 'tm'] },
      { emoji: '©️', name: 'copyright', keywords: ['copyright', '©'] },
      { emoji: '®️', name: 'registered', keywords: ['registered', '®'] },
      { emoji: '〰️', name: 'wavy dash', keywords: ['wavy', 'dash'] },
      { emoji: '➰', name: 'curly loop', keywords: ['loop', 'curly'] },
      { emoji: '➿', name: 'double curly loop', keywords: ['loop', 'double'] },
      { emoji: '🔚', name: 'end arrow', keywords: ['end'] },
      { emoji: '🔙', name: 'back arrow', keywords: ['back'] },
      { emoji: '🔛', name: 'on! arrow', keywords: ['on'] },
      { emoji: '🔝', name: 'top arrow', keywords: ['top'] },
      { emoji: '🔜', name: 'soon arrow', keywords: ['soon'] },
      { emoji: '✔️', name: 'check mark', keywords: ['check', 'mark'] },
      { emoji: '☑️', name: 'check box with check', keywords: ['check', 'box'] },
      { emoji: '🔘', name: 'radio button', keywords: ['radio', 'button'] },
      { emoji: '🔴', name: 'red circle', keywords: ['red', 'circle'] },
      { emoji: '🟠', name: 'orange circle', keywords: ['orange', 'circle'] },
      { emoji: '🟡', name: 'yellow circle', keywords: ['yellow', 'circle'] },
      { emoji: '🟢', name: 'green circle', keywords: ['green', 'circle'] },
      { emoji: '🔵', name: 'blue circle', keywords: ['blue', 'circle'] },
      { emoji: '🟣', name: 'purple circle', keywords: ['purple', 'circle'] },
      { emoji: '⚫', name: 'black circle', keywords: ['black', 'circle'] },
      { emoji: '⚪', name: 'white circle', keywords: ['white', 'circle'] },
      { emoji: '🟤', name: 'brown circle', keywords: ['brown', 'circle'] },
      { emoji: '🔺', name: 'red triangle pointed up', keywords: ['red', 'triangle', 'up'] },
      { emoji: '🔻', name: 'red triangle pointed down', keywords: ['red', 'triangle', 'down'] },
      { emoji: '🔸', name: 'small orange diamond', keywords: ['orange', 'diamond', 'small'] },
      { emoji: '🔹', name: 'small blue diamond', keywords: ['blue', 'diamond', 'small'] },
      { emoji: '🔶', name: 'large orange diamond', keywords: ['orange', 'diamond', 'large'] },
      { emoji: '🔷', name: 'large blue diamond', keywords: ['blue', 'diamond', 'large'] },
      { emoji: '🔳', name: 'white square button', keywords: ['white', 'square'] },
      { emoji: '🔲', name: 'black square button', keywords: ['black', 'square'] },
      { emoji: '▪️', name: 'black small square', keywords: ['black', 'square', 'small'] },
      { emoji: '▫️', name: 'white small square', keywords: ['white', 'square', 'small'] },
      { emoji: '◾', name: 'black medium-small square', keywords: ['black', 'square'] },
      { emoji: '◽', name: 'white medium-small square', keywords: ['white', 'square'] },
      { emoji: '◼️', name: 'black medium square', keywords: ['black', 'square'] },
      { emoji: '◻️', name: 'white medium square', keywords: ['white', 'square'] },
      { emoji: '⬛', name: 'black large square', keywords: ['black', 'square', 'large'] },
      { emoji: '⬜', name: 'white large square', keywords: ['white', 'square', 'large'] },
      { emoji: '🟥', name: 'red square', keywords: ['red', 'square'] },
      { emoji: '🟧', name: 'orange square', keywords: ['orange', 'square'] },
      { emoji: '🟨', name: 'yellow square', keywords: ['yellow', 'square'] },
      { emoji: '🟩', name: 'green square', keywords: ['green', 'square'] },
      { emoji: '🟦', name: 'blue square', keywords: ['blue', 'square'] },
      { emoji: '🟪', name: 'purple square', keywords: ['purple', 'square'] },
      { emoji: '🟫', name: 'brown square', keywords: ['brown', 'square'] },
    ]
  }
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string, name: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function EmojiPicker({ onEmojiSelect, trigger, className }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter emojis based on search query
  const filteredCategories = emojiCategories.map(category => ({
    ...category,
    emojis: category.emojis.filter(emoji => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return emoji.name.toLowerCase().includes(query) ||
             emoji.keywords.some(keyword => keyword.toLowerCase().includes(query));
    })
  })).filter(category => category.emojis.length > 0);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleEmojiClick = (emoji: Emoji) => {
    onEmojiSelect(emoji.emoji, emoji.name);
    setIsOpen(false);
    setSearchQuery('');
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className={className}>
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex flex-col h-96">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emojis..."
                className="pl-9 pr-8"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

          {searchQuery ? (
            // Search Results
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4">
                {filteredCategories.map((category) => (
                  <div key={category.id}>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      {category.name}
                    </h4>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji, index) => (
                        <Button
                          key={`${category.id}-${index}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmojiClick(emoji)}
                          className="h-8 w-8 p-0 hover:bg-muted"
                          title={emoji.name}
                        >
                          <span className="text-lg">{emoji.emoji}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {filteredCategories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No emojis found</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            // Category View
            <>
              {/* Category Tabs */}
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col">
                <TabsList className="grid grid-cols-6 h-auto p-1 m-2">
                  {emojiCategories.map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="h-8 w-8 p-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      title={category.name}
                    >
                      <span className="text-sm">{category.icon}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Emoji Grid */}
                <div className="flex-1">
                  {emojiCategories.map((category) => (
                    <TabsContent
                      key={category.id}
                      value={category.id}
                      className="m-0 h-full"
                    >
                      <ScrollArea className="h-full p-3">
                        <div className="grid grid-cols-8 gap-1">
                          {category.emojis.map((emoji, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEmojiClick(emoji)}
                              className="h-8 w-8 p-0 hover:bg-muted"
                              title={emoji.name}
                            >
                              <span className="text-lg">{emoji.emoji}</span>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </div>
              </>
            )}
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simple emoji button component for reactions
interface EmojiButtonProps {
  emoji: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function EmojiButton({ emoji, count, active, onClick, className }: EmojiButtonProps) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "h-6 px-2 text-xs gap-1",
        active && "bg-primary/10 border-primary",
        className
      )}
    >
      <span>{emoji}</span>
      {count && count > 0 && <span>{count}</span>}
    </Button>
  );
}