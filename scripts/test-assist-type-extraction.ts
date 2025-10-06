#!/usr/bin/env tsx

import { DataProcessor } from "../src/processors/DataProcessor";
import { readFileSync } from "fs";
import { ApiResponse } from "../src/types/api";

async function testAssistTypeExtraction() {
  const processor = new DataProcessor();

  // テストケース1: 回避支援キャラクター（ビリー）
  console.log("=== テストケース1: 回避支援キャラクター（ビリー） ===");
  try {
    const billyData = JSON.parse(
      readFileSync("json/mock/billy-assist-type.json", "utf-8")
    ) as ApiResponse;

    const assistType = processor.extractAssistType(billyData);
    console.log("抽出結果:", assistType);
    console.log("期待値: evasive");
    console.log(
      "テスト結果:",
      assistType === "evasive" ? "✅ 成功" : "❌ 失敗"
    );
  } catch (error) {
    console.error("テスト1でエラー:", (error as Error).message);
  }

  console.log("\n=== テストケース2: パリィ支援キャラクター（ライカン） ===");
  try {
    const lycaonData = JSON.parse(
      readFileSync("json/mock/lycaon-assist-type.json", "utf-8")
    ) as ApiResponse;

    const assistType = processor.extractAssistType(lycaonData);
    console.log("抽出結果:", assistType);
    console.log("期待値: defensive");
    console.log(
      "テスト結果:",
      assistType === "defensive" ? "✅ 成功" : "❌ 失敗"
    );
  } catch (error) {
    console.error("テスト2でエラー:", (error as Error).message);
  }

  console.log("\n=== テストケース3: 支援タイプなしキャラクター ===");
  try {
    const noAssistData = JSON.parse(
      readFileSync("json/mock/no-assist-type.json", "utf-8")
    ) as ApiResponse;

    const assistType = processor.extractAssistType(noAssistData);
    console.log("抽出結果:", assistType);
    console.log("期待値: undefined");
    console.log(
      "テスト結果:",
      assistType === undefined ? "✅ 成功" : "❌ 失敗"
    );
  } catch (error) {
    console.error("テスト3でエラー:", (error as Error).message);
  }

  // 実際のAPIからのテスト
  console.log("\n=== 実際のAPIテスト ===");
  try {
    const { HoyoLabApiClient } = await import(
      "../src/clients/HoyoLabApiClient"
    );
    const client = new HoyoLabApiClient();

    // ビリー・キッド（回避支援）
    console.log("ビリー・キッド（ID: 19）をテスト中...");
    const billyResponse = await client.fetchCharacterData(19, "ja-jp");
    const billyAssistType = processor.extractAssistType(billyResponse);
    console.log("ビリー支援タイプ:", billyAssistType);

    // ライカン（パリィ支援）
    console.log("ライカン（ID: 28）をテスト中...");
    const lycaonResponse = await client.fetchCharacterData(28, "ja-jp");
    const lycaonAssistType = processor.extractAssistType(lycaonResponse);
    console.log("ライカン支援タイプ:", lycaonAssistType);
  } catch (error) {
    console.error("実際のAPIテストでエラー:", (error as Error).message);
  }
}

testAssistTypeExtraction();
