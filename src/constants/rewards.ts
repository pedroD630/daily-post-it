/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;  // lucide-react icon name (resolved at render time)
  emoji: string; // textual fallback
}

export const REWARDS: Reward[] = [
  { id: "day-off",     name: "Day Off",            cost: 1000, icon: "Sunset",          emoji: "🌅" },
  { id: "ifood",       name: "iFood Order",        cost: 800,  icon: "UtensilsCrossed", emoji: "🍔" },
  { id: "shopping",    name: "Shopping Trip",      cost: 500,  icon: "ShoppingBag",     emoji: "🛍️" },
  { id: "clothes",     name: "New Clothes",        cost: 600,  icon: "Shirt",           emoji: "👕" },
  { id: "videogames",  name: "1h of Video Games",  cost: 100,  icon: "Gamepad2",        emoji: "🎮" },
  { id: "tiktok",      name: "30min of TikTok",    cost: 80,   icon: "Smartphone",      emoji: "📱" },
  { id: "movie",       name: "Movie Night",        cost: 300,  icon: "Popcorn",         emoji: "🍿" },
  { id: "nap",         name: "Guilt-free Nap",     cost: 150,  icon: "Moon",            emoji: "😴" },
  { id: "pizza",       name: "Order a Pizza",      cost: 400,  icon: "Pizza",           emoji: "🍕" },
  { id: "skip-gym",    name: "Skip the Gym Today", cost: 250,  icon: "Dumbbell",        emoji: "💪" },
];
