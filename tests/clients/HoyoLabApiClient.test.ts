import { describe, it, expect, beforeEach, vi } from "vitest";
import { HoyoLabApiClient } from "../../src/clients/HoyoLabApiClient";
import { ApiError } from "../../src/errors";

// fetchをモック
global.fetch = vi.fn();

describe("HoyoLabApiClient", () => {
  let client: HoyoLabApiClient;

  beforeEach(() => {
    client = new HoyoLabApiClient();
    vi.clearAllMocks();
  });

  describe("fetchCharacterData", () => {
    const mockApiResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          modules: [
            {
              components: [],
            },
          ],
        },
      },
    };

    it("正常なAPIレスポンスを取得できる", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue(mockApiResponse),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await client.fetchCharacterData(28, "ja-jp");

      expect(result).toEqual(mockApiResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("entry_page_id=28"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "application/json",
          }),
        })
      );
    });

    it("HTTPエラーの場合はApiErrorを投げる", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "HTTP 404: Not Found"
      );
    });

    it("不正なコンテンツタイプの場合はApiErrorを投げる", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/html" }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "予期しないコンテンツタイプ: text/html"
      );
    });

    it("ネットワークエラーの場合はApiErrorを投げる", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "ネットワークエラー: Failed to fetch"
      );
    });

    it("タイムアウトの場合はApiErrorを投げる", async () => {
      vi.mocked(fetch).mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            setTimeout(() => reject(error), 100);
          })
      );

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "リクエストタイムアウト"
      );
    });

    it("APIエラーレスポンスの場合はApiErrorを投げる", async () => {
      const errorResponse = {
        retcode: -1,
        message: "Invalid request",
        data: null,
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue(errorResponse),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "APIエラー: retcode=-1, message=Invalid request"
      );
    });

    it("ページIDが一致しない場合はApiErrorを投げる", async () => {
      const mismatchResponse = {
        retcode: 0,
        message: "OK",
        data: {
          page: {
            id: "29", // 期待値28と異なる
            name: "Other Character",
            modules: [],
          },
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue(mismatchResponse),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterData(28, "ja-jp")).rejects.toThrow(
        "ページIDが一致しません: 期待値=28, 実際値=29"
      );
    });
  });

  describe("fetchCharacterDataBothLanguages", () => {
    const mockJaResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "フォン・ライカン",
          modules: [
            {
              components: [],
            },
          ],
        },
      },
    };

    const mockEnResponse = {
      retcode: 0,
      message: "OK",
      data: {
        page: {
          id: "28",
          name: "Von Lycaon",
          modules: [
            {
              components: [],
            },
          ],
        },
      },
    };

    it("両言語のデータを並行取得できる", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ...mockResponse,
          json: vi.fn().mockResolvedValue(mockJaResponse),
        } as any)
        .mockResolvedValueOnce({
          ...mockResponse,
          json: vi.fn().mockResolvedValue(mockEnResponse),
        } as any);

      const result = await client.fetchCharacterDataBothLanguages(28);

      expect(result).toEqual({
        ja: mockJaResponse,
        en: mockEnResponse,
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("lang=ja-jp"),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("lang=en-us"),
        expect.any(Object)
      );
    });

    it("いずれかのリクエストが失敗した場合はApiErrorを投げる", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: vi.fn().mockResolvedValue(mockJaResponse),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as any);

      await expect(client.fetchCharacterDataBothLanguages(28)).rejects.toThrow(
        ApiError
      );
      await expect(client.fetchCharacterDataBothLanguages(28)).rejects.toThrow(
        "多言語データの取得に失敗しました (pageId: 28)"
      );
    });
  });
});
