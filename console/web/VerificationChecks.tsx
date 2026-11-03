import type { HandoffCheck } from '../server/types.ts';
import { verificationLabels } from '../shared/progress.ts';

import {checkTitle,statusReason} from '../shared/verification.ts';

export function VerificationChecks({ checks, onGraphSelect }: { checks: HandoffCheck[]; onGraphSelect: (id:string)=>void }) {
  return <div className="verification-checks">{checks.map(check => <article key={check.id} data-check-id={check.id} className="verification-check">
    <div className="row between"><h4>{checkTitle(check)}</h4><span className={`badge ${check.status==='passed'?'positive':check.status==='failed'?'negative':''}`}>{verificationLabels[check.status]}</span></div>
    <p className="small">{statusReason(check.status)}</p>
    <dl className="check-explanation"><dt>확인할 내용</dt><dd>{check.purpose || '이 검사가 확인하는 동작을 아직 설명하지 않았어요.'}</dd><dt>필요한 이유</dt><dd>{check.rationale || '검사가 필요한 이유를 아직 등록하지 않았어요.'}</dd><dt>통과 조건</dt><dd>{check.expected || '기대 결과를 아직 등록하지 않았어요. 명령 성공만으로 요구 전체의 충족을 판단하지 않아요.'}</dd></dl>
    <p className="small">확인 범위: {check.scope}</p>
    {check.cases?.map(example => <div key={example.operation} className="check-example"><h4>대표 상황</h4><p>{example.situation}</p><p className="small">기대 결과: {example.expected}</p><h4>실제 관찰 · {verificationLabels[example.status]}</h4><p>{example.observed}</p></div>)}
    <details><summary>실행 근거 보기</summary><p className="small">결과를 재현하거나 실패 원인을 확인할 때 사용하는 명령과 실제 출력이에요.</p><pre>{check.command}</pre><p className="small">프로젝트 루트에서 실행 · 종료 코드 {check.exitCode ?? '미확인'}{check.recordedAt ? ` · ${new Date(check.recordedAt).toLocaleString('ko-KR')}` : ''}</p>{!!check.files.length && <p className="small">검사 파일: {check.files.join(', ')}</p>}{check.outputTruncated && <p className="small">출력은 앞 100,000자만 표시해요. 전체 내용은 원본 로그에서 확인해 주세요.</p>}<pre>{check.output || '실행 기록이 아직 없어요.'}</pre>{check.nodeId && <button className="text-button" onClick={()=>onGraphSelect(check.nodeId!)}>실제 실행 원문 보기</button>}</details>
  </article>)}</div>;
}
