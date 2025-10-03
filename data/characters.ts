import { Character } from "../src/types";

export default [
  {
    id: "lycaon",
    name: { ja: "フォン・ライカン", en: "フォン・ライカン" },
    fullName: { ja: "フォン・ライカン", en: "フォン・ライカン" },
    specialty: "stun",
    stats: "ice",
    attackType: "strike",
    faction: 2,
    rarity: "S",
    attr: {
      hp: [677, 1967, 3350, 4732, 6114, 7498, 8416],
      atk: [105, 197, 296, 394, 494, 592, 653],
      def: [49, 141, 241, 340, 441, 540, 606],
      impact: 119,
      critRate: 5,
      critDmg: 50,
      anomalyMastery: 91,
      anomalyProficiency: 90,
      penRatio: 0,
      energy: 1.2,
    },
  }
] as Character[];
