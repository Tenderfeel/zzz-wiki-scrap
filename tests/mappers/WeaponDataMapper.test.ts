import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WeaponDataMapper } from "../../src/mappers/WeaponDataMapper";
import { MappingError } from "../../src/errors";
import {
  ApiResponse,
  Module,
  Component,
  AscensionData,
  BaseInfoData,
} from "../../src/types/api";
import {
  BasicWeaponInfo,
  WeaponSkillInfo,
  WeaponAttributesInfo,
  WeaponAgentInfo,
} from "../../src/types/index";

// Mock Logger
vi.mock("../../src/utils/Logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WeaponDataMapper", () => {
  let weaponDataMapper: WeaponDataMapper;

  beforeEach(() => {
    weaponDataMapper = new WeaponDataMapper();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("extractBasicWeaponInfo", () => {
    it("API応答から基本武器情報を正常に抽出する", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "123",
            name: "テスト音動機",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
            filter_values: {
              w_engine_rarity: { values: ["S"] },
              filter_key_13: { values: ["強攻"] },
            },
          },
        },
      };

      const result = weaponDataMapper.extractBasicWeaponInfo(
        mockApiResponse,
        "test-weapon"
      );

      expect(result).toEqual({
        id: "test-weapon",
        name: "テスト音動機",
        rarity: "S",
        specialty: "強攻",
      });
    });

    it("filter_valuesが存在しない場合でも基本情報を抽出する", () => {
      const mockApiResponse: ApiResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "123",
            name: "テスト音動機",
            agent_specialties: { values: [] },
            agent_stats: { values: [] },
            agent_rarity: { values: [] },
            agent_faction: { values: [] },
            modules: [],
          },
        },
      };

      const result = weaponDataMapper.extractBasicWeaponInfo(
        mockApiResponse,
        "test-weapon"
      );

      expect(result).toEqual({
        id: "test-weapon",
        name: "テスト音動機",
        rarity: "",
        specialty: undefined,
      });
    });

    it("エラーが発生した場合はMappingErrorを投げる", () => {
      const mockApiResponse = null as any;

      expect(() =>
        weaponDataMapper.extractBasicWeaponInfo(mockApiResponse, "test-weapon")
      ).toThrow(MappingError);
    });
  });

  describe("extractWeaponSkillInfo", () => {
    it("equipment_skillコンポーネントからスキル情報を正常に抽出する", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "equipment_skill",
              data: JSON.stringify({
                skill_name: "テストスキル名",
                skill_desc: "テストスキル説明",
              }),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponSkillInfo(mockModules);

      expect(result).toEqual({
        equipmentSkillName: "テストスキル名",
        equipmentSkillDesc: "テストスキル説明",
      });
    });

    it("HTMLタグを除去してスキル情報を抽出する", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "equipment_skill",
              data: JSON.stringify({
                skill_name: "<p>テストスキル名</p>",
                skill_desc: "<div>テスト<strong>スキル</strong>説明</div>",
              }),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponSkillInfo(mockModules);

      expect(result).toEqual({
        equipmentSkillName: "テストスキル名",
        equipmentSkillDesc: "テストスキル説明",
      });
    });

    it("equipment_skillコンポーネントが見つからない場合は空の値を返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "other_component",
              data: "{}",
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponSkillInfo(mockModules);

      expect(result).toEqual({
        equipmentSkillName: "",
        equipmentSkillDesc: "",
      });
    });

    it("JSONパースエラーが発生した場合は空の値を返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "equipment_skill",
              data: "invalid json",
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponSkillInfo(mockModules);

      expect(result).toEqual({
        equipmentSkillName: "",
        equipmentSkillDesc: "",
      });
    });
  });

  describe("extractWeaponAttributes", () => {
    it("ascensionコンポーネントから突破ステータスの「後」値を正常に抽出する", () => {
      const ascensionData: AscensionData = {
        list: [
          {
            key: "0",
            combatList: [
              { key: "HP", values: ["100", "120"] },
              { key: "攻撃力", values: ["50", "60"] },
            ],
          },
          {
            key: "10",
            combatList: [
              { key: "HP", values: ["150", "180"] },
              { key: "攻撃力", values: ["75", "90"] },
            ],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify(ascensionData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponAttributes(mockModules);

      // 「後」の値（配列インデックス1）のみが抽出されることを確認
      expect(result.hp[0]).toBe(120); // レベル0の「後」値
      expect(result.hp[1]).toBe(180); // レベル10の「後」値
      expect(result.atk[0]).toBe(60); // レベル0の「後」値
      expect(result.atk[1]).toBe(90); // レベル10の「後」値
    });

    it("7レベル分のデータを正しい順序で抽出する", () => {
      const ascensionData: AscensionData = {
        list: [
          { key: "0", combatList: [{ key: "HP", values: ["100", "120"] }] },
          { key: "10", combatList: [{ key: "HP", values: ["150", "180"] }] },
          { key: "20", combatList: [{ key: "HP", values: ["200", "240"] }] },
          { key: "30", combatList: [{ key: "HP", values: ["250", "300"] }] },
          { key: "40", combatList: [{ key: "HP", values: ["300", "360"] }] },
          { key: "50", combatList: [{ key: "HP", values: ["350", "420"] }] },
          { key: "60", combatList: [{ key: "HP", values: ["400", "480"] }] },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify(ascensionData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponAttributes(mockModules);

      expect(result.hp).toEqual([120, 180, 240, 300, 360, 420, 480]);
    });

    it("日本語ステータス名を英語属性にマッピングする", () => {
      const ascensionData: AscensionData = {
        list: [
          {
            key: "0",
            combatList: [
              { key: "HP", values: ["100", "120"] },
              { key: "基礎攻撃力", values: ["50", "60"] },
              { key: "防御力", values: ["30", "36"] },
              { key: "衝撃力", values: ["40", "48"] },
              { key: "会心率", values: ["5%", "6%"] },
              { key: "会心ダメージ", values: ["50%", "60%"] },
              { key: "異常マスタリー", values: ["10", "12"] },
              { key: "異常掌握", values: ["15", "18"] },
              { key: "貫通率", values: ["20%", "24%"] },
              { key: "エネルギー自動回復", values: ["25", "30"] },
            ],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify(ascensionData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponAttributes(mockModules);

      expect(result.hp[0]).toBe(120);
      expect(result.atk[0]).toBe(60);
      expect(result.def[0]).toBe(36);
      expect(result.impact[0]).toBe(48);
      expect(result.critRate[0]).toBe(6);
      expect(result.critDmg[0]).toBe(60);
      expect(result.anomalyMastery[0]).toBe(12);
      expect(result.anomalyProficiency[0]).toBe(18);
      expect(result.penRatio[0]).toBe(24);
      expect(result.energy[0]).toBe(30);
    });

    it("「-」値を無視して処理を継続する", () => {
      const ascensionData: AscensionData = {
        list: [
          {
            key: "0",
            combatList: [
              { key: "HP", values: ["100", "120"] },
              { key: "攻撃力", values: ["-", "-"] },
              { key: "防御力", values: ["30", "36"] },
            ],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "ascension",
              data: JSON.stringify(ascensionData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponAttributes(mockModules);

      expect(result.hp[0]).toBe(120);
      expect(result.atk[0]).toBe(0); // デフォルト値
      expect(result.def[0]).toBe(36);
    });

    it("ascensionコンポーネントが見つからない場合は空の属性を返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "other_component",
              data: "{}",
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractWeaponAttributes(mockModules);

      expect(result.hp).toEqual(new Array(7).fill(0));
      expect(result.atk).toEqual(new Array(7).fill(0));
      expect(result.def).toEqual(new Array(7).fill(0));
    });
  });

  describe("extractAgentInfo", () => {
    it("baseInfoから該当エージェント情報を正常に抽出する", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "該当エージェント",
            values: ['{"ep_id": 123, "name": "テストエージェント"}'],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractAgentInfo(mockModules);

      expect(result).toEqual({
        agentId: "123",
      });
    });

    it("ep_idが含まれていない場合はundefinedを返す", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "該当エージェント",
            values: ['{"name": "テストエージェント"}'],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractAgentInfo(mockModules);

      expect(result).toEqual({
        agentId: undefined,
      });
    });

    it("該当エージェント項目が存在しない場合はundefinedを返す", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "その他の項目",
            values: ["テスト値"],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractAgentInfo(mockModules);

      expect(result).toEqual({
        agentId: undefined,
      });
    });

    it("baseInfoコンポーネントが見つからない場合はundefinedを返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "other_component",
              data: "{}",
            },
          ],
        },
      ];

      const result = weaponDataMapper.extractAgentInfo(mockModules);

      expect(result).toEqual({
        agentId: undefined,
      });
    });
  });

  describe("extractBaseAndAdvancedAttributes", () => {
    it("基礎・上級ステータス属性を正常に抽出する", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "基礎ステータス",
            values: ["基礎攻撃力"],
          },
          {
            key: "上級ステータス",
            values: ["会心率"],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result).toEqual({
        baseAttr: "atk", // 「基礎攻撃力」から「基礎」を除去して「攻撃力」→「atk」
        advancedAttr: "critRate",
      });
    });

    it("基礎ステータスから「基礎」を除去してマッピングする", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "基礎ステータス",
            values: ["基礎攻撃力"],
          },
          {
            key: "上級ステータス",
            values: ["会心ダメージ"],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result.baseAttr).toBe("atk"); // 「基礎攻撃力」→「攻撃力」→「atk」
      expect(result.advancedAttr).toBe("critDmg");
    });

    it("HTMLタグを除去してステータス名を処理する", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "基礎ステータス",
            values: ["<p>基礎攻撃力</p>"],
          },
          {
            key: "上級ステータス",
            values: ["<div>会心率</div>"],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result.baseAttr).toBe("atk");
      expect(result.advancedAttr).toBe("critRate");
    });

    it("ステータス情報が見つからない場合はデフォルト値を返す", () => {
      const baseInfoData: BaseInfoData = {
        list: [
          {
            key: "その他の項目",
            values: ["テスト値"],
          },
        ],
      };

      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: JSON.stringify(baseInfoData),
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result).toEqual({
        baseAttr: "atk", // デフォルト値
        advancedAttr: "critRate", // デフォルト値
      });
    });

    it("baseInfoコンポーネントが見つからない場合はデフォルト値を返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "other_component",
              data: "{}",
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result).toEqual({
        baseAttr: "atk", // デフォルト値
        advancedAttr: "critRate", // デフォルト値
      });
    });

    it("エラーが発生した場合はデフォルト値を返す", () => {
      const mockModules: Module[] = [
        {
          name: "test-module",
          components: [
            {
              component_id: "baseInfo",
              data: "invalid json",
            },
          ],
        },
      ];

      const result =
        weaponDataMapper.extractBaseAndAdvancedAttributes(mockModules);

      expect(result).toEqual({
        baseAttr: "atk", // デフォルト値
        advancedAttr: "critRate", // デフォルト値
      });
    });
  });
});
