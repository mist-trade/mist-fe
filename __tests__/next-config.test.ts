import nextConfig from "../next.config";

const originalEnv = process.env;

describe("next config local API proxy", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MIST_API_PROXY_TARGET;
    delete process.env.CHAN_API_PROXY_TARGET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not add API rewrites unless local proxy targets are configured", async () => {
    await expect(nextConfig.rewrites?.()).resolves.toEqual([]);
  });

  it("rewrites same-origin API paths to configured local targets", async () => {
    process.env.MIST_API_PROXY_TARGET = "http://192.168.31.182:8001/";
    process.env.CHAN_API_PROXY_TARGET = "http://192.168.31.182:8008/";

    await expect(nextConfig.rewrites?.()).resolves.toEqual([
      {
        source: "/api/mist/:path*",
        destination: "http://192.168.31.182:8001/:path*",
      },
      {
        source: "/api/chan/:path*",
        destination: "http://192.168.31.182:8008/:path*",
      },
    ]);
  });
});
