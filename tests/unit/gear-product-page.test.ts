import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  checkProductUrl,
  groundedSpec,
  isPublicAddress,
  pageText,
} from "@/features/gear/product-page";
import { fetchProductPage } from "@/server/gear/product-page";

const html = `<!doctype html><html><head>
<title>HOKA Speedgoat 7 – Chaussure de trail homme</title>
<meta property="og:description" content="Accroche et amorti pour les sentiers techniques.">
<script type="application/ld+json">{"@type":"Product","name":"Speedgoat 7","brand":{"name":"HOKA"}}</script>
<script>window.tracking = "drop 99 mm";</script>
<style>.x{}</style>
</head><body>
<h1>Speedgoat 7</h1>
<ul><li>Drop : 5 mm</li><li>Poids : 295 g (pointure 42)</li>
<li>Hauteur talon / avant-pied : 38 mm / 33 mm</li>
<li>Crampons Vibram&reg; Megagrip de 5 mm</li></ul>
</body></html>`;

describe("product page reading", () => {
  it("keeps visible text, metadata and structured data but not scripts", () => {
    const text = pageText(html);
    expect(text).toContain("HOKA Speedgoat 7");
    expect(text).toContain('"brand":{"name":"HOKA"}');
    expect(text).toContain("Drop : 5 mm");
    expect(text).not.toContain("tracking");
  });

  it("accepts public https pages only", () => {
    expect(checkProductUrl("https://www.hoka.com/fr/speedgoat-7").ok).toBe(
      true,
    );
    for (const url of [
      "http://www.hoka.com/x",
      "https://user:pass@hoka.com/x",
      "ftp://hoka.com",
      "pas une url",
    ])
      expect(checkProductUrl(url)).toEqual({ ok: false, reason: "invalid" });
    for (const url of [
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.0.0.4/x",
      "https://[::1]/x",
      "https://homelab.tail042a16.ts.net:10000/",
      "https://hoka.com:8443/x",
    ])
      expect(checkProductUrl(url)).toEqual({ ok: false, reason: "blocked" });
    expect(isPublicAddress("192.168.1.10")).toBe(false);
    expect(isPublicAddress("100.101.4.2")).toBe(false);
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicAddress("151.101.1.140")).toBe(true);
  });
});

describe("grounded extraction", () => {
  const text = pageText(html);

  it("keeps values quoted from the page", () => {
    expect(
      groundedSpec(
        {
          fields: {
            brand: { value: "HOKA", evidence: "HOKA Speedgoat 7" },
            model: { value: "Speedgoat", evidence: "HOKA Speedgoat 7" },
            version: { value: "7", evidence: "Speedgoat 7" },
            category: { value: "trail", evidence: "Chaussure de trail homme" },
            dropMm: { value: 5, evidence: "Drop : 5 mm" },
            weightG: { value: 295, evidence: "Poids : 295 g (pointure 42)" },
            stackHeelMm: { value: 38, evidence: "38 mm / 33 mm" },
            stackForefootMm: { value: 33, evidence: "38 mm / 33 mm" },
            lugDepthMm: { value: 5, evidence: "Megagrip de 5 mm" },
            plate: null,
          },
        },
        text,
      ),
    ).toEqual({
      brand: "HOKA",
      model: "Speedgoat",
      version: "7",
      category: "trail",
      dropMm: 5,
      weightG: 295,
      stackHeelMm: 38,
      stackForefootMm: 33,
      lugDepthMm: 5,
    });
  });

  it("drops values whose quote is not on the page or does not hold them", () => {
    expect(
      groundedSpec(
        {
          fields: {
            foam: { value: "CMEVA", evidence: "Mousse CMEVA" },
            dropMm: { value: 4, evidence: "Drop : 5 mm" },
            weightG: { value: 280, evidence: "Poids : 280 g" },
            plate: { value: "carbon", evidence: "plaque carbone" },
            model: { value: "Mafate", evidence: "HOKA Speedgoat 7" },
            stackHeelMm: { value: 99, evidence: "drop 99 mm" },
          },
        },
        text,
      ),
    ).toEqual({});
    expect(groundedSpec("not json", text)).toEqual({});
  });
});

describe("product page fetch", () => {
  const page = (body: string, init: ResponseInit = {}) =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      ...init,
    });

  it("reads a public page", async () => {
    const result = await fetchProductPage(
      "https://www.hoka.com/fr/speedgoat-7",
      {
        resolve: async () => ["151.101.1.140"],
        send: (async () => page(html)) as typeof fetch,
      },
    );
    expect(result.ok && result.text).toContain("Drop : 5 mm");
  });

  it("refuses hosts that resolve to private addresses", async () => {
    const send = vi.fn();
    const result = await fetchProductPage("https://rebind.example.com/x", {
      resolve: async () => ["10.0.0.2"],
      send: send as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "blocked" });
    expect(send).not.toHaveBeenCalled();
  });

  it("checks every redirect before following it", async () => {
    const send = vi.fn(async () =>
      page("", {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    );
    const result = await fetchProductPage("https://shop.example.com/x", {
      resolve: async () => ["151.101.1.140"],
      send: send as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rejects pages that are not html", async () => {
    const result = await fetchProductPage("https://shop.example.com/x.pdf", {
      resolve: async () => ["151.101.1.140"],
      send: (async () =>
        new Response("%PDF", {
          headers: { "content-type": "application/pdf" },
        })) as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "unreadable" });
  });
});
