/**
 * 구조화 출력 스트림에서 배열 원소가 완성될 때마다 하나씩 뽑아내는 증분 파서.
 *
 * 왜 필요한가 (스펙 §6 "SSE 스트리밍 (토큰 단위 렌더링)"):
 *   구조화 출력을 쓰면 모델은 `{"questions":[{...},{...}]}` 형태의 JSON을 토큰 단위로 흘려보낸다.
 *   전부 받고 나서 JSON.parse 하면 스트리밍의 의미가 없다 — 사용자는 10초를 빈 화면으로 본다.
 *   그래서 흘러오는 텍스트를 지켜보다가 배열 원소 하나가 `}` 로 닫히는 순간 그 조각만 파싱해서
 *   바로 클라이언트로 밀어준다. 질문이 한 개씩 화면에 쌓인다.
 *
 * 토큰 조각은 문자열 중간에서 잘려 들어오기 때문에, 중괄호만 세면 안 되고
 * 문자열/이스케이프 상태를 같이 추적해야 한다.
 */
export class IncrementalArrayParser {
  private buffer = "";
  private cursor = 0;
  private arrayStarted = false;
  private arrayEnded = false;
  private depth = 0;
  private objectStart = -1;
  private inString = false;
  private escaped = false;

  /** `{"questions": [...]}` 의 "questions" 처럼, 배열이 달려 있는 키 이름 */
  constructor(private readonly arrayKey: string) {}

  /**
   * 새 텍스트 조각을 밀어 넣고, 이번에 **완성된** 배열 원소들을 돌려준다.
   * 아직 완성된 게 없으면 빈 배열.
   */
  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const completed: unknown[] = [];

    if (!this.arrayStarted && !this.locateArrayStart()) return completed;

    while (!this.arrayEnded && this.cursor < this.buffer.length) {
      const ch = this.buffer[this.cursor];

      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        this.cursor++;
        continue;
      }

      if (ch === '"') {
        this.inString = true;
      } else if (ch === "{") {
        if (this.depth === 0) this.objectStart = this.cursor;
        this.depth++;
      } else if (ch === "}") {
        this.depth--;
        if (this.depth === 0 && this.objectStart >= 0) {
          const raw = this.buffer.slice(this.objectStart, this.cursor + 1);
          this.objectStart = -1;
          try {
            completed.push(JSON.parse(raw));
          } catch {
            // 방어적: 여기까지 왔으면 균형 잡힌 JSON이어야 한다.
            // 아니라면 그 원소만 조용히 버리고 스트림은 계속 간다.
          }
        }
      } else if (ch === "]" && this.depth === 0) {
        this.arrayEnded = true;
        this.cursor++;
        break;
      }

      this.cursor++;
    }

    return completed;
  }

  /** 스트림이 끝났는데 아직 배열이 닫히지 않았다면 잘린 것이다. */
  get truncated(): boolean {
    return this.arrayStarted && !this.arrayEnded;
  }

  /** 아무것도 못 찾았을 때 원인을 보려고 남겨 둔다. */
  get rawBuffer(): string {
    return this.buffer;
  }

  /** `"questions"` 키 뒤의 여는 대괄호를 찾아 커서를 그 다음으로 옮긴다. */
  private locateArrayStart(): boolean {
    const keyIndex = this.buffer.indexOf(`"${this.arrayKey}"`);
    if (keyIndex < 0) return false;

    const bracket = this.buffer.indexOf("[", keyIndex);
    if (bracket < 0) return false;

    this.cursor = bracket + 1;
    this.arrayStarted = true;
    return true;
  }
}
