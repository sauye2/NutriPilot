import type { FoodProfile } from "@/lib/types";

export const foodProfiles: FoodProfile[] = [
  {
    name: "Skirt steak",
    aliases: ["skirt steak", "steak", "beef steak"],
    per100g: { calories: 240, protein: 26, carbs: 0, fat: 15 },
    gramsByUnit: { g: 1, piece: 170, cup: 140 },
  },
  {
    name: "Rice",
    aliases: ["rice", "white rice", "cooked rice"],
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    gramsByUnit: { g: 1, cup: 158, tbsp: 10, tsp: 3.3 },
  },
  {
    name: "Olive oil",
    aliases: ["olive oil", "oil", "extra virgin olive oil"],
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    gramsByUnit: { g: 1, tbsp: 13.5, tsp: 4.5, cup: 216 },
  },
  {
    name: "Egg",
    aliases: ["egg", "eggs", "whole egg"],
    per100g: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
    gramsByUnit: { g: 1, piece: 50, cup: 243 },
  },
  {
    name: "Chicken breast",
    aliases: ["chicken breast", "chicken", "grilled chicken"],
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    gramsByUnit: { g: 1, piece: 170, cup: 140 },
  },
  {
    name: "Potato",
    aliases: ["potato", "potatoes", "baked potato"],
    per100g: { calories: 93, protein: 2.5, carbs: 21, fat: 0.1 },
    gramsByUnit: { g: 1, piece: 173, cup: 150 },
  },
];

export const ingredientNameOptions = foodProfiles.map((profile) => profile.name);
