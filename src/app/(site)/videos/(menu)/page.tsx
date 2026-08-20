import type { Metadata } from "next";
import Link from "next/link";
import VideoSubmitForm from "@/components/VideoSubmitForm";

export const metadata: Metadata = {
  title: "영상 요약",
  description: "유튜브 영상을 붙여넣으면 타임스탬프가 달린 보고서로 요약합니다.",
};

export default function VideosPage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>영상 요약</h1>
        <p>
          유튜브 영상 주소를 붙여넣으면 자막(없으면 음성 인식)을 읽어{" "}
          <b>타임스탬프가 달린 보고서</b>로 정리합니다. 면접·취업·개발 학습과 관련된
          영상만 요약하며, 이미 요약된 영상은 바로 열립니다.
        </p>
      </section>

      <section className="section" style={{ marginTop: 0 }}>
        <VideoSubmitForm />
      </section>

      <p className="footnote">
        전에 요약한 영상은 <Link href="/videos/history">요약 기록</Link>에 있습니다.
      </p>
    </>
  );
}
