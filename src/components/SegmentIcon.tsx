import React from 'react';
import { 
  Scissors, 
  Sparkles, 
  Eye, 
  Crown, 
  PenTool, 
  Apple, 
  Brain, 
  Activity, 
  Dumbbell, 
  Camera, 
  Video, 
  Compass, 
  Palette, 
  Car, 
  Hammer,
  Flame,
  HeartPulse,
  Wand2,
  Salad,
  Smile,
  Trophy,
  Film,
  Ruler,
  Brush,
  Gauge,
  Axe,
  HelpCircle
} from 'lucide-react';

interface SegmentIconProps {
  iconName?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SegmentIcon({ iconName, className = 'w-5 h-5', style }: SegmentIconProps) {
  const normalized = iconName?.toLowerCase() || '';

  switch (normalized) {
    case 'scissors':
      return <Scissors className={className} style={style} />;
    case 'sparkles':
    case 'sparkle':
      return <Sparkles className={className} style={style} />;
    case 'eye':
      return <Eye className={className} style={style} />;
    case 'crown':
      return <Crown className={className} style={style} />;
    case 'pentool':
    case 'pen':
      return <PenTool className={className} style={style} />;
    case 'apple':
      return <Apple className={className} style={style} />;
    case 'brain':
      return <Brain className={className} style={style} />;
    case 'activity':
      return <Activity className={className} style={style} />;
    case 'dumbbell':
      return <Dumbbell className={className} style={style} />;
    case 'camera':
      return <Camera className={className} style={style} />;
    case 'video':
    case 'film':
      return <Video className={className} style={style} />;
    case 'compass':
    case 'ruler':
      return <Compass className={className} style={style} />;
    case 'palette':
    case 'brush':
      return <Palette className={className} style={style} />;
    case 'car':
    case 'gauge':
      return <Car className={className} style={style} />;
    case 'hammer':
    case 'axe':
      return <Hammer className={className} style={style} />;
    case 'heartpulse':
      return <HeartPulse className={className} style={style} />;
    case 'wand2':
      return <Wand2 className={className} style={style} />;
    case 'flame':
      return <Flame className={className} style={style} />;
    default:
      return <Sparkles className={className} style={style} />;
  }
}
