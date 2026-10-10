import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAgentIdByName,
  extractAgentNameFromApiValue,
  AGENT_NAME_TO_ID_MAP,
} from "../../src/utils/AgentMapping";
import characters from "../../data/characters";

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

      it("英語名はマッピング対象外のため空文字を返す", () => {
        // AGENT_NAME_TO_ID_MAP は日本語名のみを持ち、英語名のフォールバックは無い
        const result = getAgentIdByName("Ellen Joe");
        expect(result).toBe("");
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
        expect(getAgentIdByName("リュシア・エロウェン")).toBe("lucia");
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
        expect(getAgentIdByName("エレン・ジョー")).toBe("ellen");
        expect(getAgentIdByName("ellen joe")).toBe(""); // 英語名はマップに存在しない
        expect(getAgentIdByName("Ellen Joe")).toBe(""); // 英語名はマップに存在しない
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
        // 完全一致が存在しない部分名でテスト（"アンドー・イワノフ"に含まれる）
        const result = getAgentIdByName("イワノフ");
        expect(result).toBe("anton");
      });

      it("部分一致でエージェントIDを取得する（フルネーム→短縮名）", () => {
        // フルネームが入力された場合、短縮名でマッチする
        const result = getAgentIdByName("フォン・ライカン・テスト");
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
        const result = getAgentIdByName("アンドー・イワノフ・テスト");
        expect(result).toBe("anton");
      });

      it("部分一致のデバッグ情報が出力される（マップ名に含まれる）", () => {
        mockConsoleDebug.mockClear();
        // "イワノフ"は"アンドー・イワノフ"に含まれる
        getAgentIdByName("イワノフ");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          expect.stringContaining(
            "[AgentMapping] 部分一致で発見（マップ名に含まれる）"
          )
        );
      });

      it("部分一致のデバッグ情報が出力される（入力名に含まれる）", () => {
        mockConsoleDebug.mockClear();
        // "フォン・ライカン・テスト"には"ライカン"が含まれる
        getAgentIdByName("フォン・ライカン・テスト");
        expect(mockConsoleDebug).toHaveBeenCalledWith(
          expect.stringContaining(
            "[AgentMapping] 部分一致で発見（入力名に含まれる）"
          )
        );
      });

      it("英語名は部分一致でもマッチしない", () => {
        // 英語名のキーは存在しないため部分一致も起こらない
        expect(getAgentIdByName("Ellen Joe Test")).toBe("");
        expect(getAgentIdByName("Von")).toBe("");
      });

      it("日本語と英語の混在した名前でも日本語部分で部分一致する", () => {
        // "エレン・ジョー"の日本語部分"エレン"が入力に含まれるため部分一致する
        const result = getAgentIdByName("Ellen・エレン");
        expect(result).toBe("ellen");
      });

      it("特殊文字を含む名前の部分一致", () => {
        // 特殊文字（・、スペース等）を含む名前での部分一致
        expect(getAgentIdByName("「11号」・テスト")).toBe("soldier11");
        expect(getAgentIdByName("ジェーン・ドゥ・テスト")).toBe("jane");
      });

      it("複数の候補がある場合は最初に見つかったものを返す", () => {
        // 複数の候補がある場合のテスト
        // "アンドー・"は"アンドー"/"アンドー・イワノフ"にマッチし、"アンビー"にはマッチしない
        const result = getAgentIdByName("アンドー・");
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
        '$[{"ep_id": 50, "name": "リュシア・エロウェン", "icon": "lucia.png", "menuId": "test", "_menuId": "test2"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("リュシア・エロウェン");
    });

    it("JSON解析失敗時にフォールバック処理を実行する", () => {
      // $[...]$形式は存在するが、JSON解析が失敗する場合
      const apiValue = '$[不正なJSON形式 "name":"ライカン"]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("ライカン");
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
      const apiValue = '$[{"ep_id": 29, "name": "猫又"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe("猫又");
    });

    it("エスケープされた文字を含むnameフィールドを処理する", () => {
      const apiValue = '$[{"ep_id": 29, "name": "テスト\\"キャラクター"}]$';
      const result = extractAgentNameFromApiValue(apiValue);
      expect(result).toBe('テスト"キャラクター');
    });
  });

  describe("AGENT_NAME_TO_ID_MAP", () => {
    // マップのソース・オブ・トゥルースは data/characters.ts
    const mappedIds = new Set(Object.values(AGENT_NAME_TO_ID_MAP));
    const mappedCharacters = characters.filter((c) => mappedIds.has(c.id));

    describe("新しいマッピングエントリの検証", () => {
      it("新キャラクター（リュシア）のマッピングが存在する", () => {
        expect(AGENT_NAME_TO_ID_MAP["リュシア"]).toBe("lucia");
        expect(AGENT_NAME_TO_ID_MAP["リュシア・エロウェン"]).toBe("lucia");
      });

      it("英語名はマッピングに含まれない", () => {
        expect(AGENT_NAME_TO_ID_MAP["Lucia"]).toBeUndefined();
        expect(AGENT_NAME_TO_ID_MAP["Ellen Joe"]).toBeUndefined();
      });

      it("新キャラクターのagentIdが正しい形式（小文字英数字）", () => {
        const luciaId = AGENT_NAME_TO_ID_MAP["リュシア"];
        expect(luciaId).toBe("lucia");
        expect(luciaId).toMatch(/^[a-z0-9_]+$/);
      });
    });

    describe("既存マッピングエントリの検証", () => {
      it("既存キャラクターのマッピングが正しく存在する", () => {
        const testCases = [
          { name: "エレン・ジョー", id: "ellen" },
          { name: "ライカン", id: "lycaon" },
          { name: "フォン・ライカン", id: "lycaon" },
          { name: "ビリー・キッド", id: "billy" },
          { name: "猫又", id: "nekomata" },
          { name: "朱鳶", id: "zhuyuan" },
          { name: "「11号」", id: "soldier11" },
          { name: "0号・アンビー", id: "soldier0anby" },
        ];

        testCases.forEach(({ name, id }) => {
          expect(AGENT_NAME_TO_ID_MAP[name]).toBe(id);
        });
      });

      it("全てのagentIdが正しい形式（小文字英数字）", () => {
        mappedIds.forEach((agentId) => {
          expect(agentId).toMatch(/^[a-z0-9_]+$/);
          expect(agentId).not.toContain(" "); // スペースは含まない
          expect(agentId).not.toContain("-"); // ハイフンは含まない
        });
      });

      it("全てのagentIdが data/characters.ts に存在する", () => {
        const characterIds = new Set(characters.map((c) => c.id));
        mappedIds.forEach((agentId) => {
          expect(characterIds.has(agentId)).toBe(true);
        });
      });
    });

    describe("マッピング構造の検証", () => {
      it("全てのキーが日本語名である", () => {
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        const keys = Object.keys(AGENT_NAME_TO_ID_MAP);
        const nonJapaneseKeys = keys.filter(
          (name) => !japanesePattern.test(name)
        );

        expect(keys.length).toBeGreaterThan(0);
        expect(nonJapaneseKeys).toEqual([]);
        expect(keys).toContain("リュシア");
      });

      it("マッピングテーブルに重複するagentIdが存在することを確認", () => {
        const agentIds = Object.values(AGENT_NAME_TO_ID_MAP);

        // 同じキャラクターの複数の名前形式があるため、重複は正常
        expect(agentIds.length).toBeGreaterThan(mappedIds.size);

        // 新キャラクター（リュシア）も短縮名とフルネームのエントリがあることを確認
        const luciaEntries = agentIds.filter((id) => id === "lucia");
        expect(luciaEntries.length).toBe(2);
      });

      it("各キャラクターに短縮名とフルネームの両方がマッピングされている", () => {
        // data/characters.ts の name.ja / fullName.ja が両方マップに存在すること
        expect(mappedCharacters.length).toBe(mappedIds.size);
        mappedCharacters.forEach((c) => {
          expect(AGENT_NAME_TO_ID_MAP[c.name.ja]).toBe(c.id);
          expect(AGENT_NAME_TO_ID_MAP[c.fullName.ja]).toBe(c.id);
        });
      });

      it("マッピングテーブルのサイズが適切", () => {
        const totalEntries = Object.keys(AGENT_NAME_TO_ID_MAP).length;

        // 各キャラクターに1つ以上のエントリがあり、多くは複数ある
        expect(totalEntries).toBeGreaterThan(mappedIds.size);
        expect(totalEntries).toBeLessThanOrEqual(mappedIds.size * 3);

        // 新キャラクター追加後も適切なサイズを維持
        expect(totalEntries).toBeGreaterThan(50); // 最低限のエントリ数
      });
    });

    describe("マッピングの一貫性検証", () => {
      it("同じキャラクターの異なる名前形式が同じagentIdを返す", () => {
        const ellenIds = ["エレン", "エレン・ジョー"].map(
          (name) => AGENT_NAME_TO_ID_MAP[name]
        );
        expect(ellenIds.every((id) => id === "ellen")).toBe(true);

        const luciaIds = ["リュシア", "リュシア・エロウェン"].map(
          (name) => AGENT_NAME_TO_ID_MAP[name]
        );
        expect(luciaIds.every((id) => id === "lucia")).toBe(true);
      });

      it("特殊文字を含む名前も正しくマッピングされている", () => {
        // 日本語の中点（・）を含む名前
        expect(AGENT_NAME_TO_ID_MAP["エレン・ジョー"]).toBe("ellen");
        expect(AGENT_NAME_TO_ID_MAP["リュシア・エロウェン"]).toBe("lucia");

        // かぎ括弧・全角記号を含む名前
        expect(AGENT_NAME_TO_ID_MAP["「トリガー」"]).toBe("trigger");
        expect(AGENT_NAME_TO_ID_MAP["オルペウス＆「鬼火」"]).toBe("orphie");
      });

      it("漢字を含む名前も正しくマッピングされている", () => {
        expect(AGENT_NAME_TO_ID_MAP["朱鳶"]).toBe("zhuyuan");
        expect(AGENT_NAME_TO_ID_MAP["月城柳"]).toBe("yanagi");
        expect(AGENT_NAME_TO_ID_MAP["星見雅"]).toBe("miyabi");
      });
    });
  });
});
