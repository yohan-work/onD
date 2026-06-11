import type { BenchmarkSuite } from "@/lib/types";

export function createStarterSuite(): BenchmarkSuite {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: "Starter local model benchmark",
    description:
      "A compact Korean-first suite covering instruction following, summary, code, and factual explanation.",
    createdAt: timestamp,
    updatedAt: timestamp,
    cases: [
      {
        id: crypto.randomUUID(),
        title: "Korean concise explanation",
        category: "qa",
        prompt:
          "온디바이스 LLM의 장점과 한계를 한국어로 정확히 4개의 불릿으로 설명해줘.",
      },
      {
        id: crypto.randomUUID(),
        title: "Structured summary",
        category: "summary",
        prompt:
          "다음 내용을 핵심 주장, 근거, 위험 요소의 3개 섹션으로 요약해줘: 로컬 LLM은 개인정보 보호와 오프라인 사용에 유리하지만, 하드웨어 자원과 모델 업데이트 관리가 필요하다. 작은 모델은 빠르지만 복잡한 추론에 약할 수 있고 큰 모델은 품질이 좋지만 메모리 요구량이 높다.",
      },
      {
        id: crypto.randomUUID(),
        title: "TypeScript utility",
        category: "code",
        prompt:
          "중복 문자열을 제거하면서 최초 순서를 유지하는 TypeScript 함수와 간단한 테스트 예시를 작성해줘. 외부 라이브러리는 사용하지 마.",
      },
      {
        id: crypto.randomUUID(),
        title: "Strict JSON instruction",
        category: "instruction",
        prompt:
          "로컬 LLM 테스트 체크리스트 3개를 JSON 배열로만 출력해줘. 각 항목은 title과 done 필드를 가지며 done은 false여야 한다.",
      },
    ],
  };
}
