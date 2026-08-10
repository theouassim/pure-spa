import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("../../hash", () => ({
  hashEmail: (e: string) => `hashed_${e}`,
  hashPhone: (p: string) => `hashed_${p}`,
}));

import { sendTikTokServerEvent, type TikTokServerEventInput } from "../tiktok.server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const mockedFrom = vi.mocked(supabaseAdmin.from);

describe("tiktok.server adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  function setupCredentials(creds: { access_token: string; dataset_id: string; test_event_code: string } | null) {
    mockedFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: creds,
            error: null,
          }),
        }),
      }),
    } as never);
  }

  const BASE_INPUT: TikTokServerEventInput = {
    eventName: "CompletePayment",
    eventId: "payment_cs_abc",
    eventTime: 1723284000,
    eventSourceUrl: "https://booking.purespainstitut.com/reserver/confirmation",
    userData: {
      email: "alice@test.com",
      phone: "0612345678",
      ttclid: "tt_click_123",
      ttp: "ttp_abc",
      clientIpAddress: "1.2.3.4",
      clientUserAgent: "Mozilla/5.0",
    },
    properties: { value: 50, currency: "EUR" },
  };

  it("does nothing if credentials are not configured", async () => {
    setupCredentials(null);
    await sendTikTokServerEvent(BASE_INPUT);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does nothing if access_token is empty", async () => {
    setupCredentials({ access_token: "", dataset_id: "pixel_123", test_event_code: "" });
    await sendTikTokServerEvent(BASE_INPUT);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends correctly shaped payload to TikTok Events API", async () => {
    setupCredentials({ access_token: "tt_token", dataset_id: "pixel_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await sendTikTokServerEvent(BASE_INPUT);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("business-api.tiktok.com");

    expect(options.headers["Access-Token"]).toBe("tt_token");

    const body = JSON.parse(options.body);
    expect(body.event_source).toBe("web");
    expect(body.event_source_id).toBe("pixel_123");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event).toBe("CompletePayment");
    expect(body.data[0].event_id).toBe("payment_cs_abc");
    expect(body.data[0].page.url).toBe("https://booking.purespainstitut.com/reserver/confirmation");
    expect(body.data[0].user.email).toBe("hashed_alice@test.com");
    expect(body.data[0].user.phone_number).toBe("hashed_0612345678");
    expect(body.data[0].user.ttclid).toBe("tt_click_123");
    expect(body.data[0].user.ttp).toBe("ttp_abc");
    expect(body.data[0].user.ip).toBe("1.2.3.4");
    expect(body.data[0].user.user_agent).toBe("Mozilla/5.0");
    expect(body.data[0].properties).toEqual({ value: 50, currency: "EUR" });
  });

  it("includes test_event_code when set", async () => {
    setupCredentials({ access_token: "tt_token", dataset_id: "pixel_123", test_event_code: "TEST_CODE" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await sendTikTokServerEvent(BASE_INPUT);

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.test_event_code).toBe("TEST_CODE");
  });

  it("retries once on failure", async () => {
    setupCredentials({ access_token: "tt_token", dataset_id: "pixel_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("err") })
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("err") });

    await sendTikTokServerEvent(BASE_INPUT);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not throw on network error", async () => {
    setupCredentials({ access_token: "tt_token", dataset_id: "pixel_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));

    await expect(sendTikTokServerEvent(BASE_INPUT)).resolves.toBeUndefined();
  });
});
