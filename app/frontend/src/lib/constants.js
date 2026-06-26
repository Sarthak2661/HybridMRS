import { BarChart3, Check, EyeOff, Film, Heart, Info, Search, SlidersHorizontal, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

export const tabs = [
  { id: "home", label: "Home", icon: Film },
  { id: "onboarding", label: "Movie Selection", icon: Search },
  { id: "recommendations", label: "Recommendations", icon: Sparkles },
  { id: "controls", label: "Controls", icon: SlidersHorizontal },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "about", label: "Methodology", icon: Info }
];

export const feedbackActions = [
  { action: "like", label: "Like", icon: ThumbsUp },
  { action: "dislike", label: "Dislike", icon: ThumbsDown },
  { action: "already_watched", label: "Watched", icon: Check },
  { action: "not_interested", label: "Hide", icon: EyeOff },
  { action: "more_like_this", label: "More", icon: Heart }
];

