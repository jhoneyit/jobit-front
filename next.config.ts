import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LLM 호출이 route handler 안에서 길게 돌기 때문에 Node 런타임을 기본으로 둔다.
  // (Edge 런타임에서는 @anthropic-ai/sdk 스트리밍 타임아웃 제어가 제한적)
  experimental: {
    proxyTimeout: 120_000,
  },

  /**
   * 내 기록·계정 설정이 `/profile` 아래로 들어갔다. 옛 주소는 북마크나 밖에서
   * 걸린 링크로 계속 들어오므로 죽이지 않고 넘긴다.
   *
   * `permanent: true` — 되돌릴 계획이 없는 이전이다. 다만 308 은 브라우저가
   * 오래 캐시하므로, 되돌릴 여지가 생기면 이 값부터 뒤집어야 한다.
   */
  async redirects() {
    return [
      { source: "/history", destination: "/profile/history", permanent: true },
      { source: "/account", destination: "/profile/settings", permanent: true },
    ];
  },
};

export default nextConfig;
