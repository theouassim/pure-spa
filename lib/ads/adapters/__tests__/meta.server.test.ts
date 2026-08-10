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
  hashName: (n: string) => `hashed_${n}`,
}));

import { sendMetaServerEvent, type MetaServerEventInput } from "../meta.server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const mockedFrom = vi.mocked(supabaseAdmin.from);

describe("meta.server adapter", () => {
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

  const BASE_INPUT: MetaServerEventInput = {
    eventName: "Purchase",
    eventId: "payment_cs_abc",
    eventTime: 1723284000,
    eventSourceUrl: "https://booking.purespainstitut.com/reserver/confirmation",
    actionSource: "website",
    userData: {
      email: "alice@test.com",
      phone: "0612345678",
      firstName: "Alice",
      lastName: "Dupont",
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.click",
      clientIpAddress: "1.2.3.4",
      clientUserAgent: "Mozilla/5.0",
    },
    customData: { value: 50, currency: "EUR" },
  };

  it("does nothing if credentials are not configured", async () => {
    setupCredentials(null);
    await sendMetaServerEvent(BASE_INPUT);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does nothing if access_token is empty", async () => {
    setupCredentials({ access_token: "", dataset_id: "ds_123", test_event_code: "" });
    await sendMetaServerEvent(BASE_INPUT);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends correctly shaped payload to Meta CAPI", async () => {
    setupCredentials({ access_token: "EAAtest", dataset_id: "ds_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await sendMetaServerEvent(BASE_INPUT);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("graph.facebook.com/v21.0/ds_123/events");
    expect(url).toContain("access_token=EAAtest");

    const body = JSON.parse(options.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe("payment_cs_abc");
    expect(body.data[0].action_source).toBe("website");
    expect(body.data[0].user_data.em).toEqual(["hashed_alice@test.com"]);
    expect(body.data[0].user_data.ph).toEqual(["hashed_0612345678"]);
    expect(body.data[0].user_data.fn).toEqual(["hashed_Alice"]);
    expect(body.data[0].user_data.ln).toEqual(["hashed_Dupont"]);
    expect(body.data[0].user_data.fbp).toBe("fb.1.123.456");
    expect(body.data[0].user_data.fbc).toBe("fb.1.123.click");
    expect(body.data[0].user_data.client_ip_address).toBe("1.2.3.4");
    expect(body.data[0].user_data.client_user_agent).toBe("Mozilla/5.0");
    expect(body.data[0].custom_data).toEqual({ value: 50, currency: "EUR" });
  });

  it("includes test_event_code when set", async () => {
    setupCredentials({ access_token: "EAAtest", dataset_id: "ds_123", test_event_code: "TEST12345" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await sendMetaServerEvent(BASE_INPUT);

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.test_event_code).toBe("TEST12345");
  });

  it("retries once on failure then stops", async () => {
    setupCredentials({ access_token: "EAAtest", dataset_id: "ds_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("error") })
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("error") });

    await sendMetaServerEvent(BASE_INPUT);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not throw on network error", async () => {
    setupCredentials({ access_token: "EAAtest", dataset_id: "ds_123", test_event_code: "" });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));

    await expect(sendMetaServerEvent(BASE_INPUT)).resolves.toBeUndefined();
  });
});
