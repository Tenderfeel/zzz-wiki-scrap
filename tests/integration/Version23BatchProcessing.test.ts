import { describe, it, expect, beforeEach, vi } from "vitest";
import { BatchProcessor } from "../../src/processors/BatchProcessor";
import { CharacterListParser } from "../../src/parsers/CharacterListParser";
import { EnhancedApiClient } from "../../src/clients/EnhancedApiClient";
import { EnhancedDataProcessor } from "../../src/processors/EnhancedDataProcessor";
import { CharacterEntry } from "../../src/types";

/**
 * バージョン2.3キャラクター（lucia, manato, yidhari）のバッチ処理テスト
 * 要件: 1.1, 1.2, 4.1, 4.2
 */
describe("Version 2.3 Batch Processing", () => {
  let batchProcessor: BatchProcessor;
  let parser: CharacterListParser;
  let mockApiClient: EnhancedApiClient;
  let mockDataProcessor: EnhancedDataProcessor;

  beforeEach(() => {
    // モックの設定
    mockApiClient = {
      fetchBothLanguages: vi.fn(),
    } as any;

    mockDataProcessor = {
      processEnhancedCharacterData: vi.fn(),
    } as any;

    batchProcessor = new BatchProcessor(mockApiClient, mockDataProcessor);
    parser = new CharacterListParser();
  });

  describe("Character Discovery", () => {
    it("should discover version 2.3 characters from Scraping.md", async () => {
      // Scraping.mdから全キャラクターを抽出
      const entries = await parser.parseScrapingFile("Scraping.md");

      // バージョン2.3キャラクターが含まれていることを確認
      const version23Characters = entries.filter((entry) =>
        ["lucia", "manato", "yidhari"].includes(entry.id)
      );

      expect(version23Characters).toHaveLength(3);

      // 各キャラクターの詳細を検証
      const lucia = version23Characters.find((c) => c.id === "lucia");
      const manato = version23Characters.find((c) => c.id === "manato");
      const yidhari = version23Characters.find((c) => c.id === "yidhari");

      expect(lucia).toBeDefined();
      expect(lucia?.pageId).toBe(907);

      expect(manato).toBeDefined();
      expect(manato?.pageId).toBe(908);

      expect(yidhari).toBeDefined();
      expect(yidhari?.pageId).toBe(909);
    });

    it("should include version 2.3 characters in processing queue", async () => {
      const entries = await parser.parseScrapingFile("Scraping.md");
      const totalCharacters = entries.length;

      // バージョン2.3キャラクターが全体の処理対象に含まれていることを確認
      expect(totalCharacters).toBeGreaterThanOrEqual(3);

      const characterIds = entries.map((e) => e.id);
      expect(characterIds).toContain("lucia");
      expect(characterIds).toContain("manato");
      expect(characterIds).toContain("yidhari");
    });
  });

  describe("Error Isolation", () => {
    it("should isolate errors between characters during batch processing", async () => {
      // テスト用のキャラクターエントリー（バージョン2.3キャラクターを含む）
      const testEntries: CharacterEntry[] = [
        { id: "lucia", pageId: 907, wikiUrl: "https://example.com/lucia" },
        { id: "manato", pageId: 908, wikiUrl: "https://example.com/manato" },
        { id: "yidhari", pageId: 909, wikiUrl: "https://example.com/yidhari" },
      ];

      // API呼び出しのモック設定（一部失敗をシミュレート）
      (mockApiClient.fetchBothLanguages as any)
        .mockResolvedValueOnce({
          ja: { page: { id: "907", name: "リュシア" } },
          en: { page: { id: "907", name: "Lucia" } },
        })
        .mockRejectedValueOnce(new Error("API Error for manato"))
        .mockResolvedValueOnce({
          ja: { page: { id: "909", name: "イドリー" } },
          en: { page: { id: "909", name: "Yidhari" } },
        });

      // データ処理のモック設定
      (mockDataProcessor.processEnhancedCharacterData as any)
        .mockResolvedValueOnce({
          id: 907,
          name: { ja: "リュシア", en: "Lucia" },
        })
        .mockResolvedValueOnce({
          id: 909,
          name: { ja: "イドリー", en: "Yidhari" },
        });

      // バッチ処理を実行
      const result = await batchProcessor.processAllCharacters(testEntries, {
        batchSize: 3,
        delayMs: 100,
        maxRetries: 1,
      });

      // 結果の検証
      expect(result.successful).toHaveLength(2); // lucia と yidhari が成功
      expect(result.failed).toHaveLength(1); // manato が失敗

      // 成功したキャラクターの確認
      const successfulIds = result.successful.map((s) => s.entry.id);
      expect(successfulIds).toContain("lucia");
      expect(successfulIds).toContain("yidhari");

      // 失敗したキャラクターの確認
      const failedIds = result.failed.map((f) => f.entry.id);
      expect(failedIds).toContain("manato");

      // エラーが適切に分離されていることを確認
      const manatoError = result.failed.find((f) => f.entry.id === "manato");
      expect(manatoError?.error).toContain("API Error for manato");
    });

    it("should continue processing other characters when one fails", async () => {
      const testEntries: CharacterEntry[] = [
        { id: "lucia", pageId: 907, wikiUrl: "https://example.com/lucia" },
        { id: "manato", pageId: 908, wikiUrl: "https://example.com/manato" },
        { id: "yidhari", pageId: 909, wikiUrl: "https://example.com/yidhari" },
      ];

      // 最初のキャラクターでエラーが発生するようにモック設定
      (mockApiClient.fetchBothLanguages as any)
        .mockRejectedValueOnce(new Error("Network error for lucia"))
        .mockResolvedValueOnce({
          ja: { page: { id: "908", name: "狛野真斗" } },
          en: { page: { id: "908", name: "Komano Manato" } },
        })
        .mockResolvedValueOnce({
          ja: { page: { id: "909", name: "イドリー" } },
          en: { page: { id: "909", name: "Yidhari" } },
        });

      (mockDataProcessor.processEnhancedCharacterData as any)
        .mockResolvedValueOnce({
          id: 908,
          name: { ja: "狛野真斗", en: "Komano Manato" },
        })
        .mockResolvedValueOnce({
          id: 909,
          name: { ja: "イドリー", en: "Yidhari" },
        });

      const result = await batchProcessor.processAllCharacters(testEntries, {
        batchSize: 3,
        delayMs: 100,
        maxRetries: 1,
      });

      // 最初のキャラクターが失敗しても、残りの処理が継続されることを確認
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);

      const successfulIds = result.successful.map((s) => s.entry.id);
      expect(successfulIds).toContain("manato");
      expect(successfulIds).toContain("yidhari");

      const failedIds = result.failed.map((f) => f.entry.id);
      expect(failedIds).toContain("lucia");
    });
  });

  describe("Batch Processing Configuration", () => {
    it("should handle version 2.3 characters with proper batch configuration", async () => {
      const testEntries: CharacterEntry[] = [
        { id: "lucia", pageId: 907, wikiUrl: "https://example.com/lucia" },
        { id: "manato", pageId: 908, wikiUrl: "https://example.com/manato" },
        { id: "yidhari", pageId: 909, wikiUrl: "https://example.com/yidhari" },
      ];

      // 全て成功するようにモック設定
      (mockApiClient.fetchBothLanguages as any).mockResolvedValue({
        ja: { page: { id: "test", name: "テスト" } },
        en: { page: { id: "test", name: "Test" } },
      });

      (mockDataProcessor.processEnhancedCharacterData as any).mockResolvedValue(
        {
          id: 1,
          name: { ja: "テスト", en: "Test" },
        }
      );

      // 異なるバッチサイズでテスト
      const result = await batchProcessor.processAllCharacters(testEntries, {
        batchSize: 2, // バッチサイズを2に設定
        delayMs: 50,
        maxRetries: 3,
      });

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // API呼び出しが適切に行われたことを確認
      expect(mockApiClient.fetchBothLanguages).toHaveBeenCalledTimes(3);
      expect(
        mockDataProcessor.processEnhancedCharacterData
      ).toHaveBeenCalledTimes(3);
    });

    it("should respect retry configuration for version 2.3 characters", async () => {
      const testEntries: CharacterEntry[] = [
        { id: "lucia", pageId: 907, wikiUrl: "https://example.com/lucia" },
      ];

      // 最初の2回は失敗、3回目で成功するようにモック設定
      (mockApiClient.fetchBothLanguages as any)
        .mockRejectedValueOnce(new Error("Temporary error 1"))
        .mockRejectedValueOnce(new Error("Temporary error 2"))
        .mockResolvedValueOnce({
          ja: { page: { id: "907", name: "リュシア" } },
          en: { page: { id: "907", name: "Lucia" } },
        });

      (mockDataProcessor.processEnhancedCharacterData as any).mockResolvedValue(
        {
          id: 907,
          name: { ja: "リュシア", en: "Lucia" },
        }
      );

      const result = await batchProcessor.processAllCharacters(testEntries, {
        batchSize: 1,
        delayMs: 10,
        maxRetries: 3, // 3回までリトライ
      });

      // リトライにより最終的に成功することを確認
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);

      // API呼び出しが3回行われたことを確認（2回失敗 + 1回成功）
      expect(mockApiClient.fetchBothLanguages).toHaveBeenCalledTimes(3);
    });
  });

  describe("Name Mapping Integration", () => {
    it("should have name mappings for version 2.3 characters", async () => {
      // name-mappings.jsonファイルを読み込み
      const fs = await import("fs");
      const nameMappingsContent = fs.readFileSync(
        "src/config/name-mappings.json",
        "utf-8"
      );
      const nameMappings = JSON.parse(nameMappingsContent);

      // バージョン2.3キャラクターのマッピングが存在することを確認
      expect(nameMappings.lucia).toBeDefined();
      expect(nameMappings.lucia.ja).toBe("リュシア");
      expect(nameMappings.lucia.en).toBe("Lucia");

      expect(nameMappings.manato).toBeDefined();
      expect(nameMappings.manato.ja).toBe("狛野真斗");
      expect(nameMappings.manato.en).toBe("Komano Manato");

      expect(nameMappings.yidhari).toBeDefined();
      expect(nameMappings.yidhari.ja).toBe("イドリー");
      expect(nameMappings.yidhari.en).toBe("Yidhari");
    });
  });
});
