import { describe, expect, it } from "vitest";
import { yandexMapsUrl } from "@/lib/dadata/yandexMapsUrl";

describe("yandexMapsUrl", () => {
  it("builds a Yandex search link from the address text", () => {
    expect(yandexMapsUrl("109316, г Москва, д 1")).toBe(
      "https://yandex.ru/maps/?text=109316%2C%20%D0%B3%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D0%B4%201"
    );
  });

  it("returns null for an empty address", () => {
    expect(yandexMapsUrl("")).toBeNull();
    expect(yandexMapsUrl("   ")).toBeNull();
    expect(yandexMapsUrl(null)).toBeNull();
  });

  it("returns null when the encoded URL is longer than 2000 characters", () => {
    expect(yandexMapsUrl("а".repeat(1800))).toBeNull();
  });
});
