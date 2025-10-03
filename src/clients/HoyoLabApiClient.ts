import { ApiResponse } from "../types/api";
import { ApiError } from "../errors";

/**
 * HoyoLab ZZZ Wiki APIクライアント
 */
export class HoyoLabApiClient {
  private readonly baseUrl =
    "https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/entry_page";
  private readonly timeout = 10000; // 10秒のタイムアウト

  /**
   * 指定されたページIDと言語でキャラクターデータを取得する
   * @param pageId キャラクターのページID
   * @param lang 言語コード ('ja-jp' または 'en-us')
   * @returns Promise<ApiResponse> APIレスポンス
   * @throws ApiError API呼び出しに失敗した場合
   */
  async fetchCharacterData(
    pageId: number,
    lang: "ja-jp" | "en-us"
  ): Promise<ApiResponse> {
    try {
      const url = this.buildUrl(pageId, lang);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; LycanDataGenerator/1.0)",
          "x-rpc-wiki_app": "zzz",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText} (URL: ${url})`
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new ApiError(
          `予期しないコンテンツタイプ: ${contentType} (URL: ${url})`
        );
      }

      const data = (await response.json()) as ApiResponse;

      // APIレスポンスの基本検証
      this.validateApiResponse(data, pageId, lang);

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ApiError(`ネットワークエラー: ${error.message}`, error);
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(`リクエストタイムアウト (${this.timeout}ms)`, error);
      }

      throw new ApiError(
        `API呼び出しに失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 日本語と英語の両方でキャラクターデータを取得する
   * @param pageId キャラクターのページID
   * @returns Promise<{ja: ApiResponse, en: ApiResponse}> 両言語のAPIレスポンス
   * @throws ApiError いずれかのAPI呼び出しに失敗した場合
   */
  async fetchCharacterDataBothLanguages(pageId: number): Promise<{
    ja: ApiResponse;
    en: ApiResponse;
  }> {
    try {
      // 並行してリクエストを実行
      const [jaResponse, enResponse] = await Promise.all([
        this.fetchCharacterData(pageId, "ja-jp"),
        this.fetchCharacterData(pageId, "en-us"),
      ]);

      return {
        ja: jaResponse,
        en: enResponse,
      };
    } catch (error) {
      throw new ApiError(
        `多言語データの取得に失敗しました (pageId: ${pageId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * APIリクエスト用のURLを構築する
   * @param pageId ページID
   * @param lang 言語コード
   * @returns 構築されたURL
   */
  private buildUrl(pageId: number, lang: "ja-jp" | "en-us"): string {
    const params = new URLSearchParams({
      entry_page_id: pageId.toString(),
      lang: lang,
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * APIレスポンスの基本構造と内容を検証する
   * @param data 検証するAPIレスポンス
   * @param pageId 期待するページID
   * @param lang 期待する言語
   * @throws ApiError レスポンスが不正な場合
   */
  private validateApiResponse(
    data: any,
    pageId: number,
    lang: string
  ): asserts data is ApiResponse {
    if (!data || typeof data !== "object") {
      throw new ApiError("APIレスポンスが無効です: オブジェクトではありません");
    }

    if (data.retcode !== 0) {
      throw new ApiError(
        `APIエラー: retcode=${data.retcode}, message=${
          data.message || "Unknown error"
        }`
      );
    }

    if (!data.data || !data.data.page) {
      throw new ApiError("APIレスポンスが無効です: page データがありません");
    }

    const page = data.data.page;

    if (page.id !== pageId.toString()) {
      throw new ApiError(
        `ページIDが一致しません: 期待値=${pageId}, 実際値=${page.id}`
      );
    }

    if (!page.name || typeof page.name !== "string") {
      throw new ApiError("APIレスポンスが無効です: キャラクター名がありません");
    }

    if (!Array.isArray(page.modules) || page.modules.length === 0) {
      throw new ApiError("APIレスポンスが無効です: modules データがありません");
    }
  }
}
