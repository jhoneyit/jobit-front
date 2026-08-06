import Image from "next/image";
import Link from "next/link";

/**
 * 푸터.
 *
 * 사업자 정보(주소·등록번호·대표번호)는 **일부러 넣지 않았다.**
 * 아직 실제 값이 없는데 형태만 채워 두면 없는 사실을 적는 셈이 된다.
 * 서비스를 실제로 운영할 때 실제 값으로 채워 넣으면 된다.
 */
export default function SiteFooter() {
  return (
    <footer className="bleed site-footer">
      <div className="bleed-inner">
        <nav className="foot-links" aria-label="푸터 메뉴">
          <Link href="/analyze">공고 분석</Link>
          <span aria-hidden="true">|</span>
          <Link href="/profile">프로필</Link>
          <span aria-hidden="true">|</span>
          <Link href="/signin">로그인</Link>
          <span aria-hidden="true">|</span>
          <Link href="/signup">회원가입</Link>
        </nav>

        <div className="foot-body">
          <p className="foot-brand">
            <Image
              className="brand-logo"
              src="/logo-wordmark.png"
              alt="jobit"
              width={207}
              height={84}
            />
          </p>
          <p className="foot-desc">
            채용공고를 붙여넣으면 그 공고의 자격요건에서 뽑아낸 예상 면접 질문과 답변 뼈대를
            만들어 드립니다.
          </p>
          <p className="foot-note">
            붙여넣은 공고는 질문 생성에 쓰이고, 같은 공고를 다시 넣는 사람을 위해 캐시됩니다.
            이력서 같은 개인 문서는 아직 받지 않습니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
