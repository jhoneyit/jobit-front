import { redirect } from "next/navigation";

/**
 * `/profile` 자체에는 보여줄 게 없다. 첫 메뉴로 넘긴다.
 *
 * 헤더의 "프로필" 은 여기를 가리킨다 — 하위 주소를 헤더가 알 필요가 없도록
 * 진입점을 하나로 두고, 어디로 갈지는 이 파일만 안다.
 */
export default function ProfilePage() {
  redirect("/profile/history");
}
