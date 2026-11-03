import { useEffect, useRef, type ReactNode } from 'react';
import icons from './design/icons.json';
export type IconName = keyof typeof icons;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">{icons[name].map((path, i) => <path d={path} key={i} />)}</svg>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} className="modal"><header className="row between"><h2>{title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><Icon name="x" /></button></header>{children}</dialog>;
}
export const nodeLabels = { feature: '기능', requirement: '요구사항', issue: '문제·이슈', decision: '결정', task: '작업', evidence: '근거', result: '실행 결과' };
export const statusLabels = { pending: '미완료', active: '진행 중', completed: '완료', failed: '실패', unverified: '미확인' };
export function timeLabel(value: number | null | undefined) {
  if (value == null || value === 0) return '대화 시각 미확인';
  const seconds = Math.max(0, (Date.now() - value) / 1000);
  if (seconds < 60) return '방금';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(value);
}
export function ErrorNotice({ message }: { message: string | null }) { return message ? <p className="error-notice" role="alert">{message}</p> : null; }
export function Loading({ children = '불러오는 중이에요.' }: { children?: ReactNode }) { return <div className="loading" role="status">{children}</div>; }
