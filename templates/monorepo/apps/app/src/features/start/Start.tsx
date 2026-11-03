import * as React from 'react';
import { Button } from '@proofstill/ui';

export function Start() {
  const [count, setCount] = React.useState(0);
  return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-bold">새 프로젝트</h1><p className="my-6 text-muted-foreground">이 화면에서 제품의 첫 작업을 만들어 보세요.</p><Button onClick={() => setCount(value => value + 1)}>시작하기</Button><p className="mt-4" aria-live="polite">시작한 횟수 {count}</p></main>;
}
