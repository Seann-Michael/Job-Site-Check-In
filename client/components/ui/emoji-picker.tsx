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
      { emoji: '👌', name: 'OK hand', keywords: ['ok', 'good'] },
      { emoji: '🤌', name: 'pinched fingers', keywords: ['italian', 'gesture'] },
      { emoji: '✌️', name: 'victory hand', keywords: ['peace', 'victory'] },
      { emoji: '🤞', name: 'crossed fingers', keywords: ['luck', 'hope'] },
      { emoji: '🤟', name: 'love-you gesture', keywords: ['love', 'you'] },
      { emoji: '🤘', name: 'sign of the horns', keywords: ['rock', 'metal'] },
      { emoji: '👈', name: 'backhand index pointing left', keywords: ['left', 'point'] },
      { emoji: '👉', name: 'backhand index pointing right', keywords: ['right', 'point'] },
      { emoji: '👆', name: 'backhand index pointing up', keywords: ['up', 'point'] },
      { emoji: '👇', name: 'backhand index pointing down', keywords: ['down', 'point'] },
      { emoji: '☝️', name: 'index pointing up', keywords: ['up', 'point'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['good', 'yes', 'like'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['bad', 'no', 'dislike'] },
      { emoji: '✊', name: 'raised fist', keywords: ['fist', 'power'] },
      { emoji: '👊', name: 'oncoming fist', keywords: ['punch', 'fist'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['praise', 'celebration'] },
      { emoji: '👐', name: 'open hands', keywords: ['open', 'hug'] },
      { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agreement'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'thanks'] },
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
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
      { emoji: '👍', name: 'thumbs up', keywords: ['good', 'yes', 'like'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['bad', 'no', 'dislike'] },
      { emoji: '💯', name: 'hundred points', keywords: ['100', 'perfect'] },
      { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'lit'] },
      { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'energy'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['praise', 'celebration'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '🤝', name: 'handshake', keywords: ['deal', 'agreement'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'thanks'] },
      { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'magic'] },
      { emoji: '⭐', name: 'star', keywords: ['star', 'favorite'] },
      { emoji: '🌟', name: 'glowing star', keywords: ['star', 'sparkle'] },
      { emoji: '💫', name: 'dizzy', keywords: ['dizzy', 'star'] },
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
      { emoji: '🦆', name: 'duck', keywords: ['duck'] },
      { emoji: '🦅', name: 'eagle', keywords: ['eagle'] },
      { emoji: '🦉', name: 'owl', keywords: ['owl'] },
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
      { emoji: '🍈', name: 'melon', keywords: ['melon', 'fruit'] },
      { emoji: '🍒', name: 'cherries', keywords: ['cherry', 'fruit'] },
      { emoji: '🍑', name: 'peach', keywords: ['peach', 'fruit'] },
      { emoji: '🥭', name: 'mango', keywords: ['mango', 'fruit'] },
      { emoji: '🍍', name: 'pineapple', keywords: ['pineapple', 'fruit'] },
      { emoji: '🥥', name: 'coconut', keywords: ['coconut', 'fruit'] },
      { emoji: '🥝', name: 'kiwi fruit', keywords: ['kiwi', 'fruit'] },
      { emoji: '🍅', name: 'tomato', keywords: ['tomato', 'vegetable'] },
      { emoji: '🥑', name: 'avocado', keywords: ['avocado', 'fruit'] },
      { emoji: '🥦', name: 'broccoli', keywords: ['broccoli', 'vegetable'] },
      { emoji: '🥕', name: 'carrot', keywords: ['carrot', 'vegetable'] },
      { emoji: '🌶️', name: 'hot pepper', keywords: ['pepper', 'spicy'] },
      { emoji: '🍄', name: 'mushroom', keywords: ['mushroom', 'vegetable'] },
      { emoji: '🍞', name: 'bread', keywords: ['bread'] },
      { emoji: '🥐', name: 'croissant', keywords: ['croissant', 'bread'] },
      { emoji: '🥖', name: 'baguette bread', keywords: ['baguette', 'bread'] },
      { emoji: '🥨', name: 'pretzel', keywords: ['pretzel'] },
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
      { emoji: '🥙', name: 'stuffed flatbread', keywords: ['pita', 'food'] },
      { emoji: '🥚', name: 'egg', keywords: ['egg', 'food'] },
      { emoji: '🍳', name: 'cooking', keywords: ['cooking', 'egg'] },
      { emoji: '🥘', name: 'shallow pan of food', keywords: ['paella', 'food'] },
      { emoji: '🍲', name: 'pot of food', keywords: ['stew', 'soup'] },
      { emoji: '🥣', name: 'bowl with spoon', keywords: ['bowl', 'cereal'] },
      { emoji: '🥗', name: 'green salad', keywords: ['salad', 'healthy'] },
      { emoji: '🍿', name: 'popcorn', keywords: ['popcorn', 'snack'] },
      { emoji: '☕', name: 'hot beverage', keywords: ['coffee', 'tea'] },
      { emoji: '🍵', name: 'teacup without handle', keywords: ['tea'] },
      { emoji: '🥤', name: 'cup with straw', keywords: ['soda', 'drink'] },
      { emoji: '🍶', name: 'sake', keywords: ['sake', 'alcohol'] },
      { emoji: '🍺', name: 'beer mug', keywords: ['beer', 'alcohol'] },
      { emoji: '🍻', name: 'clinking beer mugs', keywords: ['beer', 'cheers'] },
      { emoji: '🥂', name: 'clinking glasses', keywords: ['cheers', 'celebration'] },
      { emoji: '🍷', name: 'wine glass', keywords: ['wine', 'alcohol'] },
      { emoji: '🍸', name: 'cocktail glass', keywords: ['cocktail', 'alcohol'] },
      { emoji: '🍹', name: 'tropical drink', keywords: ['cocktail', 'tropical'] },
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚀',
    emojis: [
      { emoji: '🚗', name: 'automobile', keywords: ['car', 'vehicle'] },
      { emoji: '🚕', name: 'taxi', keywords: ['taxi', 'car'] },
      { emoji: '🚙', name: 'sport utility vehicle', keywords: ['suv', 'car'] },
      { emoji: '🚌', name: 'bus', keywords: ['bus', 'vehicle'] },
      { emoji: '🚎', name: 'trolleybus', keywords: ['trolley', 'bus'] },
      { emoji: '🏎️', name: 'racing car', keywords: ['racing', 'car', 'fast'] },
      { emoji: '🚓', name: 'police car', keywords: ['police', 'car'] },
      { emoji: '🚑', name: 'ambulance', keywords: ['ambulance', 'emergency'] },
      { emoji: '🚒', name: 'fire engine', keywords: ['fire', 'truck'] },
      { emoji: '🚐', name: 'minibus', keywords: ['minibus', 'van'] },
      { emoji: '🛻', name: 'pickup truck', keywords: ['truck', 'pickup'] },
      { emoji: '🚚', name: 'delivery truck', keywords: ['truck', 'delivery'] },
      { emoji: '🚛', name: 'articulated lorry', keywords: ['truck', 'semi'] },
      { emoji: '🚜', name: 'tractor', keywords: ['tractor', 'farm'] },
      { emoji: '🏍️', name: 'motorcycle', keywords: ['motorcycle', 'bike'] },
      { emoji: '🛵', name: 'motor scooter', keywords: ['scooter', 'bike'] },
      { emoji: '🚲', name: 'bicycle', keywords: ['bicycle', 'bike'] },
      { emoji: '🛴', name: 'kick scooter', keywords: ['scooter'] },
      { emoji: '🚁', name: 'helicopter', keywords: ['helicopter'] },
      { emoji: '✈️', name: 'airplane', keywords: ['airplane', 'plane'] },
      { emoji: '🛫', name: 'airplane departure', keywords: ['airplane', 'departure'] },
      { emoji: '🛬', name: 'airplane arrival', keywords: ['airplane', 'arrival'] },
      { emoji: '🚀', name: 'rocket', keywords: ['rocket', 'space'] },
      { emoji: '🛸', name: 'flying saucer', keywords: ['ufo', 'alien'] },
      { emoji: '🚉', name: 'station', keywords: ['station', 'train'] },
      { emoji: '🚊', name: 'tram', keywords: ['tram'] },
      { emoji: '🚝', name: 'monorail', keywords: ['monorail'] },
      { emoji: '🚞', name: 'mountain railway', keywords: ['railway', 'mountain'] },
      { emoji: '🚋', name: 'tram car', keywords: ['tram'] },
      { emoji: '🚃', name: 'railway car', keywords: ['train', 'car'] },
      { emoji: '🚂', name: 'locomotive', keywords: ['train', 'locomotive'] },
      { emoji: '🚄', name: 'high-speed train', keywords: ['train', 'fast'] },
      { emoji: '🚅', name: 'bullet train', keywords: ['train', 'bullet'] },
      { emoji: '🚆', name: 'train', keywords: ['train'] },
      { emoji: '🚇', name: 'metro', keywords: ['metro', 'subway'] },
      { emoji: '🚈', name: 'light rail', keywords: ['rail', 'light'] },
      { emoji: '⛵', name: 'sailboat', keywords: ['boat', 'sail'] },
      { emoji: '🛥️', name: 'motor boat', keywords: ['boat', 'motor'] },
      { emoji: '🚤', name: 'speedboat', keywords: ['boat', 'speed'] },
      { emoji: '🛳️', name: 'passenger ship', keywords: ['ship', 'cruise'] },
      { emoji: '⛴️', name: 'ferry', keywords: ['ferry', 'boat'] },
      { emoji: '🚢', name: 'ship', keywords: ['ship'] },
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
      { emoji: '📱', name: 'mobile phone', keywords: ['phone', 'mobile'] },
      { emoji: '☎️', name: 'telephone', keywords: ['phone', 'telephone'] },
      { emoji: '📞', name: 'telephone receiver', keywords: ['phone', 'call'] },
      { emoji: '📟', name: 'pager', keywords: ['pager'] },
      { emoji: '📠', name: 'fax machine', keywords: ['fax'] },
      { emoji: '📺', name: 'television', keywords: ['tv', 'television'] },
      { emoji: '📻', name: 'radio', keywords: ['radio'] },
      { emoji: '🎙️', name: 'studio microphone', keywords: ['microphone', 'mic'] },
      { emoji: '🎚️', name: 'level slider', keywords: ['slider', 'level'] },
      { emoji: '🎛️', name: 'control knobs', keywords: ['control', 'knobs'] },
      { emoji: '⏰', name: 'alarm clock', keywords: ['clock', 'alarm'] },
      { emoji: '🕰️', name: 'mantelpiece clock', keywords: ['clock'] },
      { emoji: '⏱️', name: 'stopwatch', keywords: ['stopwatch', 'timer'] },
      { emoji: '⏲️', name: 'timer clock', keywords: ['timer', 'clock'] },
      { emoji: '⌚', name: 'watch', keywords: ['watch', 'time'] },
      { emoji: '📷', name: 'camera', keywords: ['camera', 'photo'] },
      { emoji: '📸', name: 'camera with flash', keywords: ['camera', 'photo', 'flash'] },
      { emoji: '📹', name: 'video camera', keywords: ['camera', 'video'] },
      { emoji: '🎥', name: 'movie camera', keywords: ['camera', 'movie'] },
      { emoji: '📽️', name: 'film projector', keywords: ['projector', 'movie'] },
      { emoji: '🎞️', name: 'film frames', keywords: ['film', 'movie'] },
      { emoji: '🔍', name: 'magnifying glass tilted left', keywords: ['search', 'magnify'] },
      { emoji: '🔎', name: 'magnifying glass tilted right', keywords: ['search', 'magnify'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light'] },
      { emoji: '🔦', name: 'flashlight', keywords: ['flashlight', 'light'] },
      { emoji: '🕯️', name: 'candle', keywords: ['candle', 'light'] },
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
      { emoji: '💰', name: 'money bag', keywords: ['money', 'bag'] },
      { emoji: '💴', name: 'yen banknote', keywords: ['yen', 'money'] },
      { emoji: '💵', name: 'dollar banknote', keywords: ['dollar', 'money'] },
      { emoji: '💶', name: 'euro banknote', keywords: ['euro', 'money'] },
      { emoji: '💷', name: 'pound banknote', keywords: ['pound', 'money'] },
      { emoji: '💸', name: 'money with wings', keywords: ['money', 'fly'] },
      { emoji: '💳', name: 'credit card', keywords: ['card', 'credit'] },
      { emoji: '💎', name: 'gem stone', keywords: ['gem', 'diamond'] },
      { emoji: '🔧', name: 'wrench', keywords: ['wrench', 'tool'] },
      { emoji: '🔨', name: 'hammer', keywords: ['hammer', 'tool'] },
      { emoji: '⚒️', name: 'hammer and pick', keywords: ['tools', 'hammer'] },
      { emoji: '🛠️', name: 'hammer and wrench', keywords: ['tools'] },
      { emoji: '⛏️', name: 'pick', keywords: ['pick', 'tool'] },
      { emoji: '🔩', name: 'nut and bolt', keywords: ['nut', 'bolt'] },
      { emoji: '⚙️', name: 'gear', keywords: ['gear', 'settings'] },
      { emoji: '🎁', name: 'wrapped gift', keywords: ['gift', 'present'] },
      { emoji: '🎀', name: 'ribbon', keywords: ['ribbon', 'bow'] },
      { emoji: '🎊', name: 'confetti ball', keywords: ['confetti', 'celebration'] },
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebration'] },
      { emoji: '🎈', name: 'balloon', keywords: ['balloon', 'party'] },
      { emoji: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday'] },
      { emoji: '🍰', name: 'shortcake', keywords: ['cake', 'dessert'] },
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
            <div className="flex-1 flex flex-col">
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
              </Tabs>
            </div>
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
