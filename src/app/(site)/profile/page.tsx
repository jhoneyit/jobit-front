import { redirect } from "next/navigation";

/**
 * `/profile` 자체에는 보여줄 게 없다. 하위 화면으로 넘긴다.
 *
 * 헤더의 "프로필" 은 여기를 가리킨다 — 하위 주소를 헤더가 알 필요가 없도록
 * 진입점을 하나로 두고, 어디로 갈지는 이 파일만 안다.
 *
 * **메뉴 첫 항목("내 정보")이 아니라 기록으로 보낸다.** 프로필을 다시 열어 보는 사람은
 * 대개 지난 공고를 다시 보러 온 것이지 자기 경력을 고치러 온 게 아니다.
 */
export default function ProfilePage() {
  redirect("/profile/history");
}
