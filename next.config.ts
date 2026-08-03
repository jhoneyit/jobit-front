import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LLM 호출이 route handler 안에서 길게 돌기 때문에 Node 런타임을 기본으로 둔다.
  // (Edge 런타임에서는 @anthropic-ai/sdk 스트리밍 타임아웃 제어가 제한적)
  experimental: {
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
