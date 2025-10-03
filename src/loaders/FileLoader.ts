import * as fs from "fs";
import * as path from "path";
import { ApiResponse } from "../types/api";
import { ParsingError } from "../errors";

/**
 * ローカルファイルからAPIレスポンス形式のデータを読み込むクラス
 */
export class FileLoader {
  /**
   * 指定されたファイルパスからJSONデータを読み込み、ApiResponse形式で返す
   * @param filePath 読み込むファイルのパス（ワークスペースルートからの相対パス）
   * @returns Promise<ApiResponse> 解析されたAPIレスポンス
   * @throws ParsingError ファイル読み込みまたはJSON解析に失敗した場合
   */
  async loadFromFile(filePath: string): Promise<ApiResponse> {
    try {
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new ParsingError(`ファイルが見つかりません: ${filePath}`);
      }

      // ファイル読み込み
      const fileContent = fs.readFileSync(filePath, "utf-8");

      if (!fileContent.trim()) {
        throw new ParsingError(`ファイルが空です: ${filePath}`);
      }

      // JSON解析
      const parsedData = JSON.parse(fileContent) as ApiResponse;

      // 基本的な構造検証
      this.validateApiResponse(parsedData);

      return parsedData;
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new ParsingError(`JSONの解析に失敗しました: ${filePath}`, error);
      }

      throw new ParsingError(
        `ファイルの読み込みに失敗しました: ${filePath}`,
        error as Error
      );
    }
  }

  /**
   * APIレスポンスの基本構造を検証する
   * @param data 検証するAPIレスポンス
   * @throws ParsingError 構造が不正な場合
   */
  private validateApiResponse(data: any): asserts data is ApiResponse {
    if (!data || typeof data !== "object") {
      throw new ParsingError(
        "APIレスポンスが無効です: オブジェクトではありません"
      );
    }

    if (typeof data.retcode !== "number") {
      throw new ParsingError(
        "APIレスポンスが無効です: retcodeが数値ではありません"
      );
    }

    if (typeof data.message !== "string") {
      throw new ParsingError(
        "APIレスポンスが無効です: messageが文字列ではありません"
      );
    }

    if (!data.data || typeof data.data !== "object") {
      throw new ParsingError(
        "APIレスポンスが無効です: dataオブジェクトがありません"
      );
    }

    if (!data.data.page || typeof data.data.page !== "object") {
      throw new ParsingError(
        "APIレスポンスが無効です: data.pageオブジェクトがありません"
      );
    }

    const page = data.data.page;

    if (typeof page.id !== "string") {
      throw new ParsingError(
        "APIレスポンスが無効です: page.idが文字列ではありません"
      );
    }

    if (typeof page.name !== "string") {
      throw new ParsingError(
        "APIレスポンスが無効です: page.nameが文字列ではありません"
      );
    }

    if (!Array.isArray(page.modules)) {
      throw new ParsingError(
        "APIレスポンスが無効です: page.modulesが配列ではありません"
      );
    }
  }
}
