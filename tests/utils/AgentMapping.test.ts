import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAgentIdByName,
  extractAgentNameFromApiValue,
  AGENT_NAME_TO_ID_MAP,
} from "../../src/utils/AgentMapping";

// Mock console.debug to avoid noise in test output
const mockConsoleDebug = vi.fn();
vi.stubGlobal("console", {
  ...console,
  debug: mockConsoleDebug,
});

describe("AgentMapping", () => {
  beforeEach(() => {
    mockConsoleDebug.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAgentIdByName", () => {
    describe("完全一致テスト", () => {
      it("完全一致でエージェントIDを取得する（日本語名）", () => {
        const result = getAgentIdByName("エレン・ジョー");
        expect(result).toBe("ellen");
      });

      it("完全一致でエージェントIDを取得する（英語名）", () => {
        const result = getAgentIdByName("Ellen Joe");
        expect(result).toBe("ellen");
      });

      it("完全一致が部分一致より優先される", () => {
        // "エレン"は完全一致で存在するため、部分一致ではなく完全一致が使用される
        const result = getAgentIdByName("エレン");
        expect(result).toBe("ellen");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          '[AgentMapping] 完全一致で発見: "エレン" -> "ellen"'
        );
      });
    });

    describe("新しいマッピングエントリのテスト", () => {
      it("新キャラクター（リュシア）の日本語名マッピング", () => {
        expect(getAgentIdByName("リュシア")).toBe("lucia");
        expect(getAgentIdByName("リュシア・プラム")).toBe("lucia");
      });

      it("新キャラクター（リュシア）のマッピング", () => {
        expect(getAgentIdByName("リュシア")).toBe("lucia");
        expect(getAgentIdByName("リュシア・エロウェン")).toBe("lucia");
      });

      it("新キャラクターの部分一致も正常に動作する", () => {
        // "リュシア"で"リュシア・エロウェン"にマッチするかテスト
        const result = getAgentIdByName("リュシア");
        expect(result).toBe("lucia");
      });

      it("既存キャラクターのマッピングが維持されている", () => {
        const testCases = [
          { name: "ライカン", expected: "lycaon" },
          { name: "フォン・ライカン", expected: "lycaon" },
          { name: "ビリー", expected: "billy" },
          { name: "ビリー・キッド", expected: "billy" },
          { name: "猫又", expected: "nekomata" },
          { name: "猫宮又奈", expected: "nekomata" },
        ];

        testCases.forEach(({ name, expected }) => {
          expect(getAgentIdByName(name)).toBe(expected);
        });
      });

      it("新しく追加されたキャラクターのマッピング", () => {
        const newCharacterTests = [
          // 2.1追加キャラクター
          { name: "柚葉", expected: "yuzuha" },
          { name: "浮波柚葉", expected: "yuzuha" },
          { name: "アリス", expected: "alice" },
          { name: "アリス・タイムフィールド", expected: "alice" },

          // 2.2追加キャラクター
          { name: "シード", expected: "seed" },
          { name: "「シード」", expected: "seed" },
          { name: "オルペウス", expected: "orphie" },
          { name: "オルペウス・マグヌッソン＆「鬼火」", expected: "orphie" },
          { name: "オルペウス＆「鬼火」", expected: "orphie" },

          // 2.3追加キャラクター
          { name: "リュシア", expected: "lucia" },
          { name: "リュシア・エロウェン", expected: "lucia" },
          { name: "狛野真斗", expected: "manato" },
          { name: "イドリー", expected: "yidhari" },
          { name: "イドリー・マーフィー", expected: "yidhari" },

          // 2.0追加キャラクター
          { name: "橘福福", expected: "jufufu" },
          { name: "潘引壺", expected: "pan" },
          { name: "儀玄", expected: "yixuan" },
        ];

        newCharacterTests.forEach(({ name, expected }) => {
          expect(getAgentIdByName(name)).toBe(expected);
        });
      });
    });

    describe("改善されたgetAgentIdByName()のテスト", () => {
      it("前後の空白を除去して処理する", () => {
        const result = getAgentIdByName("  エレン・ジョー  ");
        expect(result).toBe("ellen");
      });

      it("空文字の場合は空文字を返す", () => {
        const result = getAgentIdByName("");
        expect(result).toBe("");
      });

      it("未知のエージェント名の場合は空文字を返す", () => {
        const result = getAgentIdByName("未知のキャラクター");
        expect(result).toBe("");
      });

      it("大文字小文字を区別する（完全一致のため）", () => {
        // 完全一致なので大文字小文字は区別される
        expect(getAgentIdByName("ellen joe")).toBe(""); // 小文字なので一致しない
        expect(getAgentIdByName("Ellen Joe")).toBe("ellen"); // 正確な大文字小文字で一致
      });

      it("デバッグ情報が適切に出力される（完全一致）", () => {
        mockConsoleDebug.mockClear();
        getAgentIdByName("エレン・ジョー");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          '[AgentMapping] エージェント名検索開始: "エレン・ジョー"'
        );
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          '[AgentMapping] 完全一致で発見: "エレン・ジョー" -> "ellen"'
        );
      });

      it("マッチしない場合のデバッグ情報が出力される", () => {
        mockConsoleDebug.mockClear();
        getAgentIdByName("未知のキャラクター");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          '[AgentMapping] エージェント名が見つかりませんでした: "未知のキャラクター"'
        );
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          expect.stringContaining("[AgentMapping] 利用可能なマッピング数:")
        );
      });
    });

    describe("部分一致ロジックのテスト", () => {
      it("部分一致でエージェントIDを取得する（短縮名→フルネーム）", () => {
        // 完全一致が存在しない短縮名でテスト
        const result = getAgentIdByName("ジュー");
        expect(result).toBe("zhu_yuan");
      });

      it("部分一致でエージェントIDを取得する（フルネーム→短縮名）", () => {
        // フルネームが入力された場合、短縮名でマッチする
        const result = getAgentIdByName("フォン・ライカオン・テスト");
        expect(result).toBe("lycaon");
      });

      it("最小長制限により短すぎる名前は部分一致しない", () => {
        // 2文字以下は部分一致の対象外
        expect(getAgentIdByName("エ")).toBe("");
        expect(getAgentIdByName("ア")).toBe("");
        expect(getAgentIdByName("AB")).toBe(""); // 英語でも2文字は対象外
      });

      it("最小長制限を満たす場合は部分一致する", () => {
        // 3文字以上は部分一致の対象
        const result = getAgentIdByName("エレン・");
        expect(result).toBe("ellen"); // "エレン・ジョー"にマッチ
      });

      it("部分一致の優先順位テスト", () => {
        // より長いマッチが優先されるかテスト
        // 実装では最初に見つかったものが返されるため、マッピングの順序に依存
        const result = getAgentIdByName("アントン・イワノフ・テスト");
        expect(result).toBe("anton");
      });

      it("部分一致のデバッグ情報が出力される（マップ名に含まれる）", () => {
        mockConsoleDebug.mockClear();
        // "ジュー"は"ジュー・ユアン"に含まれる
        getAgentIdByName("ジュー");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          expect.stringContaining(
            "[AgentMapping] 部分一致で発見（マップ名に含まれる）"
          )
        );
      });

      it("部分一致のデバッグ情報が出力される（入力名に含まれる）", () => {
        mockConsoleDebug.mockClear();
        // "フォン・ライカオン・テスト"には"ライカオン"が含まれる
        getAgentIdByName("フォン・ライカオン・テスト");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          expect.stringContaining(
            "[AgentMapping] 部分一致で発見（入力名に含まれる）"
          )
        );
      });

      it("英語名での部分一致も正常に動作する", () => {
        // 英語での部分一致テスト
        expect(getAgentIdByName("Ellen Joe Test")).toBe("ellen");
        expect(getAgentIdByName("Von")).toBe("lycaon");
      });

      it("日本語と英語の混在した名前でも部分一致する", () => {
        // 日本語と英語が混在した場合でも、部分一致により"Ellen"が見つかる
        const result = getAgentIdByName("Ellen・ジョー");
        expect(result).toBe("ellen");
      });

      it("特殊文字を含む名前の部分一致", () => {
        // 特殊文字（・、スペース等）を含む名前での部分一致
        expect(getAgentIdByName("ジュー・ユアン・テスト")).toBe("zhu_yuan");
        expect(getAgentIdByName("Jane Doe Test")).toBe("jane");
      });

      it("複数の候補がある場合は最初に見つかったものを返す", () => {
        // 複数の候補がある場合のテスト
        // "アント"は"アントン"にマッチし、"アンビー"よりも長いマッチなので確実
        const result = getAgentIdByName("アント");
        expect(result).toBe("anton");
      });
    });
  });

  describe("extractAgentNameFromApiValue", () => {
    it("正常な$[JSON]$形式からエージェント名を抽出する", () => {
      const apiValue =
        '$[{"ep_id": 29, "name": "エレン・ジョー", "icon": "test.png"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("エレン・ジョー");
    });

    it("複雑なJSONデータからエージェント名を抽出する", () => {
      const apiValue =
        '$[{"ep_id": 50, "name": "リュシア・プラム", "icon": "lucia.png", "menuId": "test", "_menuId": "test2"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("リュシア・プラム");
    });

    it("JSON解析失敗時にフォールバック処理を実行する", () => {
      // $[...]$形式は存在するが、JSON解析が失敗する場合
      const apiValue = '$[不正なJSON形式 "name":"ライカオン"]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("ライカオン");
    });

    it("$[...]$形式が見つからない場合は空文字を返す", () => {
      // $[...]$形式が存在しない場合は、現在の実装では空文字を返す
      const apiValue = 'データ "name":"ビリー・キッド" 他の情報';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("");
    });

    it("nameフィールドが存在しない場合は空文字を返す", () => {
      const apiValue = '$[{"ep_id": 29, "icon": "test.png"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("");
    });

    it("完全に不正な形式の場合は空文字を返す", () => {
      const apiValue = "完全に不正なデータ";
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("");
    });

    it("空文字の場合は空文字を返す", () => {
      const result = extractAgentNameFromApiValue("");
      expect(result).toBe("");
    });

    it("JSONが配列でない場合でもnameフィールドを抽出する", () => {
      const apiValue = '$[{"ep_id": 29, "name": "ネコマタ"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("ネコマタ");
    });

    it("エスケープされた文字を含むnameフィールドを処理する", () => {
      const apiValue = '$[{"ep_id": 29, "name": "テスト\\"キャラクター"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe('テスト"キャラクター');
    });
  });

  describe("AGENT_NAME_TO_ID_MAP", () => {
    describe("新しいマッピングエントリの検証", () => {
      it("新キャラクター（リュシア）のマッピングが存在する", () => {
        expect(AGENT_NAME_TO_ID_MAP["リュシア"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["リュシア・プラム"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["Lucia"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["Lucia Plum"]).toBe("lucia");
      });

      it("新キャラクターの短縮名とフルネームが両方マッピングされている", () => {
        // 日本語
        expect(AGENT_NAME_TO_ID_MAP["リュシア"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["リュシア・プラム"]).toBe("lucia");

        // 英語
        expect(AGENT_NAME_TO_ID_MAP["Lucia"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["Lucia Plum"]).toBe("lucia");
      });

      it("新キャラクターのagentIdが正しい形式（小文字スネークケース）", () => {
        const luciaId = AGENT_NAME_TO_ID_MAP["リュシア"];
        expect(luciaId).toBe("lucia");
        expect(luciaId).toMatch(/^[a-z_]+$/); // 小文字とアンダースコアのみ
      });
    });

    describe("既存マッピングエントリの検証", () => {
      it("既存キャラクターのマッピングが正しく存在する", () => {
        const testCases = [
          { name: "エレン・ジョー", id: "ellen" },
          { name: "Ellen Joe", id: "ellen" },
          { name: "ライカオン", id: "lycaon" },
          { name: "Von Lycaon", id: "lycaon" },
          { name: "ビリー・キッド", id: "billy" },
          { name: "Billy Kid", id: "billy" },
          { name: "ネコマタ", id: "nekomata" },
          { name: "Nekomata", id: "nekomata" },
          { name: "ジュー・ユアン", id: "zhu_yuan" },
          { name: "Zhu Yuan", id: "zhu_yuan" },
        ];

        testCases.forEach(({ name, id }) => {
          expect(AGENT_NAME_TO_ID_MAP[name]).toBe(id);
        });
      });

      it("全てのagentIdが正しい形式（小文字スネークケース）", () => {
        const agentIds = [...new Set(Object.values(AGENT_NAME_TO_ID_MAP))];

        agentIds.forEach((agentId) => {
          expect(agentId).toMatch(/^[a-z_]+$/);
          expect(agentId).not.toContain(" "); // スペースは含まない
          expect(agentId).not.toContain("-"); // ハイフンは含まない
        });
      });
    });

    describe("マッピング構造の検証", () => {
      it("日本語名と英語名の両方が同じagentIdにマッピングされる", () => {
        const japaneseNames = Object.keys(AGENT_NAME_TO_ID_MAP).filter((name) =>
          /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)
        );

        const englishNames = Object.keys(AGENT_NAME_TO_ID_MAP).filter(
          (name) => !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)
        );

        // 日本語名と英語名の数が適切にバランスされていることを確認
        expect(japaneseNames.length).toBeGreaterThan(0);
        expect(englishNames.length).toBeGreaterThan(0);

        // 新キャラクターも含めて両方の言語でマッピングされていることを確認
        expect(japaneseNames).toContain("リュシア");
        expect(englishNames).toContain("Lucia");
      });

      it("マッピングテーブルに重複するagentIdが存在することを確認", () => {
        const agentIds = Object.values(AGENT_NAME_TO_ID_MAP);
        const uniqueAgentIds = [...new Set(agentIds)];

        // 同じキャラクターの複数の名前形式があるため、重複は正常
        expect(agentIds.length).toBeGreaterThan(uniqueAgentIds.length);

        // 新キャラクター（リュシア）も複数のエントリがあることを確認
        const luciaEntries = agentIds.filter((id) => id === "lucia");
        expect(luciaEntries.length).toBeGreaterThanOrEqual(4); // 最低4つのエントリ
      });

      it("各キャラクターに短縮名とフルネームの両方がマッピングされている", () => {
        // 主要キャラクターについて短縮名とフルネームの両方が存在することを確認
        const characterTests = [
          { short: "エレン", full: "エレン・ジョー", id: "ellen" },
          { short: "ライカオン", full: "フォン・ライカオン", id: "lycaon" },
          { short: "ビリー", full: "ビリー・キッド", id: "billy" },
          { short: "リュシア", full: "リュシア・プラム", id: "lucia" },
        ];

        characterTests.forEach(({ short, full, id }) => {
          expect(AGENT_NAME_TO_ID_MAP[short]).toBe(id);
          expect(AGENT_NAME_TO_ID_MAP[full]).toBe(id);
        });
      });

      it("マッピングテーブルのサイズが適切", () => {
        const totalEntries = Object.keys(AGENT_NAME_TO_ID_MAP).length;
        const uniqueAgentIds = [
          ...new Set(Object.values(AGENT_NAME_TO_ID_MAP)),
        ];

        // 各キャラクターに複数のエントリがあるため、総エントリ数は一意のagentId数より多い
        expect(totalEntries).toBeGreaterThan(uniqueAgentIds.length * 2);

        // 新キャラクター追加後も適切なサイズを維持
        expect(totalEntries).toBeGreaterThan(50); // 最低限のエントリ数
      });
    });

    describe("マッピングの一貫性検証", () => {
      it("同じキャラクターの異なる名前形式が同じagentIdを返す", () => {
        // エレンの例
        const ellenVariants = [
          "エレン",
          "エレン・ジョー",
          "Ellen",
          "Ellen Joe",
        ];
        const ellenIds = ellenVariants.map(
          (name) => AGENT_NAME_TO_ID_MAP[name]
        );
        expect(ellenIds.every((id) => id === "ellen")).toBe(true);

        // リュシアの例
        const luciaVariants = [
          "リュシア",
          "リュシア・プラム",
          "Lucia",
          "Lucia Plum",
        ];
        const luciaIds = luciaVariants.map(
          (name) => AGENT_NAME_TO_ID_MAP[name]
        );
        expect(luciaIds.every((id) => id === "lucia")).toBe(true);
      });

      it("特殊文字を含む名前も正しくマッピングされている", () => {
        // 日本語の中点（・）を含む名前
        expect(AGENT_NAME_TO_ID_MAP["エレン・ジョー"]).toBe("ellen");
        expect(AGENT_NAME_TO_ID_MAP["リュシア・プラム"]).toBe("lucia");

        // 英語のスペースを含む名前
        expect(AGENT_NAME_TO_ID_MAP["Ellen Joe"]).toBe("ellen");
        expect(AGENT_NAME_TO_ID_MAP["Lucia Plum"]).toBe("lucia");
      });

      it("漢字を含む名前も正しくマッピングされている", () => {
        expect(AGENT_NAME_TO_ID_MAP["朱鳶"]).toBe("zhu_yuan");
        expect(AGENT_NAME_TO_ID_MAP["月城柳"]).toBe("yanagi");
        expect(AGENT_NAME_TO_ID_MAP["柊ミヤビ"]).toBe("miyabi");
      });
    });
  });
});
