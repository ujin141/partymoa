import { Fragment } from "react";

/**
 * 파티 상세 설명.
 *
 * **크루가 적는 글에 위계를 준다.** 지금까지는 글 전체가 같은 크기의
 * 본문이었다. 값·정원·입금 기한처럼 꼭 봐야 하는 줄이 소개 문장과
 * 같은 무게로 섞여 있으면 사람들은 안 읽고 넘긴다.
 *
 * 마크다운을 통째로 들이지 않는다. 크루 화면의 textarea 에서 손으로
 * 치는 글이라 규칙이 둘이면 충분하다.
 *
 *     ── 소제목      줄 앞에 ── 를 붙인다
 *     **굵게**       별 두 개로 감싼다
 *
 * 빈 줄은 문단 사이 간격이다. 나머지는 적은 그대로 나온다.
 */
export function Description({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return (
    <div className="text-[14.5px] leading-7 text-ink">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const head = lines[0].match(/^──\s*(.+)$/);
        const body = head ? lines.slice(1) : lines;
        return (
          <div key={bi} className={bi > 0 ? "mt-5" : undefined}>
            {head ? (
              <h3 className="mb-1.5 text-[12px] font-bold tracking-[0.16em] text-sub">
                {head[1]}
              </h3>
            ) : null}
            {body.length > 0 ? (
              <p>
                {body.map((line, li) => (
                  <Fragment key={li}>
                    {li > 0 ? <br /> : null}
                    <Inline text={line} />
                  </Fragment>
                ))}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** `**굵게**` 만 본다. 짝이 안 맞으면 별표를 그대로 보여 준다 */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <b key={i} className="font-extrabold text-ink">
            {p.slice(2, -2)}
          </b>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
