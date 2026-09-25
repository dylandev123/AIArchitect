export interface PromptSuggestion {
  id: string;
  emoji: string;
  name: string;
  description: string;
  gradient: string;
  /** Text dropped into the home-page prompt box; the user can edit it before generating. */
  prompt: string;
}

/** Style cards on the home page. They only tailor the prompt — nothing here is a project. */
export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: "dream-home",
    emoji: "🏠",
    name: "Family Home",
    description: "A warm two-storey residence",
    gradient: "from-amber-500/20 to-orange-600/20",
    prompt:
      "A two-storey craftsman family home with a timber-clad exterior, a slate gable roof, a covered front porch, a double garage with driveway, and a landscaped lawn with a patio at the back.",
  },
  {
    id: "beach-villa",
    emoji: "🏖",
    name: "Beach Villa",
    description: "A tropical waterfront retreat",
    gradient: "from-teal-500/20 to-cyan-600/20",
    prompt:
      "A single-storey beach villa with white stucco walls and a butterfly roof, a wide timber deck and a swimming pool facing the ocean at sunset, with palm-style trees and a short driveway.",
  },
  {
    id: "modern",
    emoji: "🏢",
    name: "Modern Glass House",
    description: "Clean lines and big windows",
    gradient: "from-sky-500/20 to-blue-700/20",
    prompt:
      "A modern minimalist two-storey house with a flat roof, concrete and white render walls, floor-to-ceiling glass, a cantilevered balcony, a lap pool and a garage, on a quiet suburban lot.",
  },
  {
    id: "hillside",
    emoji: "⛰",
    name: "Hillside Retreat",
    description: "A cabin with a view",
    gradient: "from-emerald-500/20 to-green-700/20",
    prompt:
      "A cozy hillside cabin in a pine forest with a steep shed roof, cedar walls, a large deck overlooking the valley at sunrise, and a gravel driveway winding up the slope.",
  },
  {
    id: "hotel",
    emoji: "🏨",
    name: "Boutique Hotel",
    description: "A hospitality destination",
    gradient: "from-blue-500/20 to-indigo-600/20",
    prompt:
      "A four-storey boutique hotel with a flat roof, white render facade with regular windows, a wide entrance, a resort pool with terrace in front, and a large parking area.",
  },
  {
    id: "restaurant",
    emoji: "🍕",
    name: "Restaurant",
    description: "A dining experience",
    gradient: "from-red-500/20 to-rose-600/20",
    prompt:
      "A single-storey industrial-style restaurant with a sawtooth roof, exposed concrete walls, large picture windows, an outdoor patio for dining, a small garden and a parking lot.",
  },
  {
    id: "coffee-shop",
    emoji: "☕",
    name: "Coffee Shop",
    description: "A cozy corner café",
    gradient: "from-yellow-500/20 to-amber-600/20",
    prompt:
      "A small nordic-style coffee shop with dark timber board-and-batten walls, a shed roof, big front windows, a little terrace with seating space and a garden beside it.",
  },
  {
    id: "villa",
    emoji: "🏛",
    name: "Mediterranean Villa",
    description: "Courtyard, terracotta and pool",
    gradient: "from-orange-500/20 to-rose-600/20",
    prompt:
      "A Mediterranean villa with warm stucco walls, a terracotta hip roof, a courtyard garden, a pool with a stone terrace, a garage and a gravel driveway, set in the countryside.",
  },
];
