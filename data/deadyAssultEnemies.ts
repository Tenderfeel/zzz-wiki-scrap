import type { DeadlyAssultEnemy } from "../src/types";
export default [
  {
    id: "defiler",
    name: {
      ja: "「冒涜者」",
    },
    weaknesses: ["electric", "physical"],
    resistances: ["ice"],
    detail: {
      ja: [
        "エージェントの『パリィ支援』が冒涜者に命中した時、チーム全体が「裁断」を1重獲得する。エージェントが空中に浮かんで攻撃している「冒涜者」を撃墜した時、チーム全体が「裁断」を4重獲得する。「裁断」は6重まで重ねがけ可能。継続時間30秒。重複して発動すると継続時間が更新される。",
        "「裁断」1重につき、エージェントの会心ダメージ+8%",
      ],
    },
    reccomend: {
      assistType: ["defensive"],
      speciality: ["attack"],
    },
  },
] as DeadlyAssultEnemy[];
