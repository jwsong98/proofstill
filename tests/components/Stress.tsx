import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { TextField, TextArea, Select, Checkbox, Switch, NumberInput, PasswordField, PinInput, Combobox, DatePicker, TimePicker, Card, List, ListRow, Table, Modal, Drawer, Accordion, CodeBlock, Banner, Button } from '@proofstill/jwdesign';
import { Button as SharedButton } from '@proofstill/ui';
import '@proofstill/ui/styles.css';

const long = '긴 내용과 공백 없는 주소 https://example.com/' + 'abcdefghijklmnopqrst'.repeat(15);
function Stress() {
  const [text, setText] = React.useState('');
  const [area, setArea] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [modal, setModal] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  const rows = Array.from({length: busy ? 100 : 3}, (_, id) => ({id, title: busy ? long : `항목 ${id + 1}`, value: id}));
  return <main style={{maxWidth: 1080, margin: 'auto', padding: 24, display: 'grid', gap: 24, minWidth: 0}}>
    <h1>컴포넌트 입력·콘텐츠 검사</h1>
    <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
      <Button onClick={() => setBusy(!busy)}>콘텐츠 {busy ? '줄이기' : '채우기'}</Button>
      <Button onClick={() => setModal(true)}>긴 모달 열기</Button>
      <Button onClick={() => setDrawer(true)}>긴 서랍 열기</Button>
      <SharedButton onClick={() => setClicks(clicks + 1)}>공유 버튼 {clicks}</SharedButton>
    </div>
    <section style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 24}}>
      <TextField label="이름" value={text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} clearable onClear={() => setText('')} helper={busy ? long : '한글과 긴 문자열을 입력하세요'} />
      <TextArea label="상세 내용" value={area} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setArea(e.target.value)} maxLength={2000} />
      <Select label="분류" defaultValue="a" options={[{value:'a', label: busy ? long : '일반'}, {value:'b',label:'두 번째'}]} />
      <Combobox label="검색 선택" options={Array.from({length:40}, (_,i) => ({value:String(i),label:`선택 ${i} ${busy ? long : ''}`}))} />
      <PasswordField label="비밀번호" showStrength />
      <NumberInput label="수량" min={0} max={100} />
      <PinInput label="인증번호" />
      <DatePicker label="날짜" />
      <TimePicker label="시간" />
      <Checkbox label={busy ? long : '약관 동의'} description={busy ? long : '선택 상태를 확인하세요'} />
      <Switch label="알림 받기" />
    </section>
    <div style={{display:'grid',gap:12,minWidth:0}}>
      <Button aria-label="긴 버튼 문구" leftIcon="check">{busy ? long : '내용 확인하기'}</Button>
      <SharedButton aria-label="긴 공유 버튼 문구">{busy ? long : '공유 버튼 확인하기'}</SharedButton>
      <Button loading>저장 중</Button><Button disabled>사용 불가</Button>
    </div>
    <output aria-label="입력 결과">{text} / {area.length}자</output>
    <Card title={busy ? long : '카드 제목'} description={busy ? long : '카드 설명'} action={<Button>상세 보기</Button>}><p>{busy ? long : '카드 본문'}</p></Card>
    <Banner title={busy ? long : '안내'}>{busy ? long : '콘텐츠를 채워 줄바꿈을 확인하세요'}</Banner>
    <List>{rows.slice(0,10).map(row => <ListRow key={row.id} title={row.title} description={busy ? long : '설명'} value="12,345" chevron />)}</List>
    <Table rowKey="id" selectable columns={[{key:'title', title:'이름', sortable:true},{key:'value',title:'수량', numeric:true}]} rows={rows} />
    <Accordion items={[{value:'one', title:'긴 본문 펼치기', content:busy ? long.repeat(4) : '본문'}]} />
    <CodeBlock code={busy ? long.repeat(4) : 'const ready = true;'} />
    <Modal open={modal} onClose={() => setModal(false)} title="긴 콘텐츠를 확인할까요?" footer={<Button onClick={() => setModal(false)}>모달 닫기</Button>}>
      {Array.from({length:30},(_,i) => <p key={i}>{i+1}. {long}</p>)}
    </Modal>
    <Drawer open={drawer} onClose={() => setDrawer(false)} title="많은 콘텐츠 확인" footer={<Button onClick={() => setDrawer(false)}>서랍 닫기</Button>}>
      {Array.from({length:30},(_,i) => <p key={i}>{i+1}. {long}</p>)}
    </Drawer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Stress />);
