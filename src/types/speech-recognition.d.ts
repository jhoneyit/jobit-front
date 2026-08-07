/**
 * Web Speech API 타입 선언.
 *
 * **TypeScript 표준 lib 에 없다.** `SpeechRecognition` 은 W3C 표준이 아니라 아직 커뮤니티
 * 초안이라, `lib.dom.d.ts` 가 들고 있지 않다. 그래서 여기서 필요한 만큼만 선언한다.
 *
 * 필요한 것만 담았다 — 전체 스펙을 옮기면 실제로 쓰지 않는 면까지 유지보수해야 한다.
 */

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  /** 이번 이벤트에서 새로 확정된 첫 인덱스. 이전 결과를 다시 이어붙이지 않게 해 준다 */
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  /** "not-allowed"(권한 거부), "no-speech", "audio-capture", "network" 등 */
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  /** Chrome·Safari 는 아직 접두사가 붙은 이름만 노출한다 */
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
