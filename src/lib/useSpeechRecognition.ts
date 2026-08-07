"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * 마이크 → 텍스트. 브라우저의 Web Speech API 를 감싼다.
 *
 * **오디오를 우리가 다루지 않는다.** `MediaRecorder` 를 쓰지 않는 이유가 이것이다 — 음성을
 * 보관하지 않기로 했으므로 오디오 버퍼를 만질 이유가 없고, 만지지 않으면 실수로 서버에 보낼
 * 경로도 생기지 않는다.
 *
 * > ⚠️ **그렇다고 음성이 아무 데도 안 가는 것은 아니다.** Chrome 의 구현은 인식을 위해
 * > 오디오를 구글 서버로 보낸다. "우리 서버에 저장하지 않는다"는 사실이지만 그 이상을
 * > 말하면 거짓이다 — 화면이 마이크를 켜기 전에 이 사실을 그대로 밝힌다.
 *
 * **Firefox 에는 이 API 가 없다.** `supported` 가 false 면 화면이 텍스트 입력으로 떨어뜨린다.
 * 채점 경로는 transcript 만 보므로 입력 수단이 무엇이든 똑같이 동작한다.
 */
export interface SpeechRecognitionState {
  /** 브라우저가 이 API 를 갖고 있는가. SSR 중에는 null (아직 모른다) */
  supported: boolean | null;
  listening: boolean;
  /** 확정된 문장들. 이것이 제출 대상이다 */
  transcript: string;
  /** 아직 확정되지 않은 조각. 말하는 중임을 보여주는 용도이고 제출하지 않는다 */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/** 사용자에게 그대로 보여줄 수 있는 문구로 옮긴다. 원문 코드는 개발자용이다. */
function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘에서 허용해 주세요.";
    case "audio-capture":
      return "마이크를 찾지 못했습니다. 연결 상태를 확인해 주세요.";
    case "network":
      return "음성 인식 중 네트워크 오류가 발생했습니다.";
    case "no-speech":
      // 오류로 취급하지 않는다 — 시간 내에 말하지 못한 것은 정상 경로이고 그 자체가 결과다.
      return "";
    default:
      return "음성 인식에 실패했습니다. 아래에 직접 입력할 수 있습니다.";
  }
}

/**
 * 브라우저가 이 API 를 갖고 있는가.
 *
 * **상태가 아니라 환경 값이다.** effect 안에서 setState 로 채우면 불필요한 렌더가 한 번 더
 * 돌고, React 도 그걸 막는다. 그렇다고 `useState` 초기화에서 바로 읽을 수도 없다 —
 * SSR 에는 `window` 가 없다.
 *
 * `useSyncExternalStore` 가 정확히 이 모양을 위한 것이다: 서버는 "아직 모른다"(null)를 주고,
 * 하이드레이션 뒤 실제 값으로 한 번 갈아탄다. 값이 바뀔 일이 없으므로 구독은 빈 함수다.
 */
const subscribeNever = () => () => {};
const readSupported = () =>
  Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
const unknownOnServer = () => null;

export function useSpeechRecognition(lang = "ko-KR"): SpeechRecognitionState {
  const supported = useSyncExternalStore<boolean | null>(
    subscribeNever,
    readSupported,
    unknownOnServer,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** stop() 을 우리가 불렀는지. 브라우저가 스스로 끊은 경우와 구분해야 한다 */
  const stoppingRef = useRef(false);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    // continuous 가 아니면 한 문장마다 멈춘다 — 90초 동안 말하게 하려면 켜야 한다.
    recognition.continuous = true;
    // 말하는 중에 화면이 비어 있으면 인식이 되는지 알 수 없어 사용자가 불안해한다.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalized = "";
      let pending = "";
      // resultIndex 부터 보는 이유: 그 앞은 이미 처리해 transcript 에 쌓았다.
      // 0부터 다시 훑으면 같은 문장이 계속 중복해서 붙는다.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalized += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (finalized) {
        setTranscript((prev) => (prev ? `${prev} ${finalized.trim()}` : finalized.trim()));
      }
      setInterim(pending);
    };

    recognition.onerror = (event) => {
      const message = describeError(event.error);
      if (message) setError(message);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      // **브라우저가 스스로 끊는다.** 몇 초간 조용하면 continuous 여도 세션을 닫아 버리는데,
      // 제한 시간이 아직 남았다면 사용자는 여전히 생각 중일 수 있다. 우리가 멈춘 게 아니면
      // 다시 켠다.
      if (!stoppingRef.current) {
        try {
          recognition.start();
          setListening(true);
        } catch {
          // 이미 시작된 상태면 start() 가 던진다. 그 경우 아무것도 하지 않아도 된다.
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      stoppingRef.current = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    stoppingRef.current = false;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // 이미 듣고 있으면 start() 가 던진다 — 이중 클릭이라 무시해도 된다.
    }
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
