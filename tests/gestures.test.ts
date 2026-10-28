import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureController, countExtendedFingers, physicalHand, smooth, Point } from '../src/gestures/GestureController';

function hand(count: number, y = 0.8, pinch = false): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: y - 0.04 }));
  p[0] = { x: 0.5, y };
  p[5] = { x: 0.35, y: y - 0.15 }; p[17] = { x: 0.65, y: y - 0.15 };
  [8,12,16,20].forEach((tip,i) => {
    p[tip-2] = { x: 0.4+i*0.06, y: y-0.17 };
    p[tip] = { x: 0.4+i*0.06, y: y-(i<count ? 0.40 : 0.04) };
  });
  p[4] = pinch ? { ...p[8] } : { x: 0.1, y: y - 0.1 };
  return p;
}
test('unmirrored camera handedness and 0–4 finger recognition', () => {
  assert.equal(physicalHand('Left'), 'Right');
  assert.equal(physicalHand('Right'), 'Left');
  for(let n=0;n<=4;n++) assert.equal(countExtendedFingers(hand(n)).count,n);
});
test('fist releases after hand loss; tempo does not jump on reacquisition', () => {
  const c = new GestureController();
  assert.equal(c.update([{ hand:'Right',landmarks:hand(0) }],100).bass,true);
  assert.equal(c.update([],200).bass,true);
  assert.equal(c.update([],281).bass,false);
  const tempo = c.tempo;
  c.update([{ hand:'Right',landmarks:hand(4,0.1) }],300);
  assert.equal(c.tempo,tempo);
});
test('pinch has hysteresis, suppresses melody, and releases after loss', () => {
  const c = new GestureController();
  c.update([{hand:'Left',landmarks:hand(2,0.8,true)}],100);
  assert.equal(c.echo,true);
  c.update([{hand:'Left',landmarks:hand(2,0.8,true)}],400);
  assert.equal(c.preset,0);
  const p=hand(2,0.8,true); p[4].x+=0.12;
  assert.equal(c.update([{hand:'Left',landmarks:p}],430).echo,true);
  p[4].x+=0.05;
  assert.equal(c.update([{hand:'Left',landmarks:p}],460).echo,false);
  c.update([{hand:'Left',landmarks:hand(2,0.8,true)}],500);
  assert.equal(c.update([],681).echo,false);
});
test('melody needs continuous dwell time, independent of frame count', () => {
  for(const fps of [15,30,60]) {
    const c=new GestureController();
    for(let t=1;t<180;t+=1000/fps) c.update([{hand:'Left',landmarks:hand(3)}],t);
    assert.equal(c.preset,0);
    c.update([{hand:'Left',landmarks:hand(3)}],200);
    assert.equal(c.preset,2);
  }
  const c=new GestureController();
  c.update([{hand:'Left',landmarks:hand(2)}],1);
  c.update([],160);
  c.update([{hand:'Left',landmarks:hand(2)}],200);
  assert.equal(c.preset,0);
});
test('tempo choice swaps tempo and filter hands, while right fist stays bass', () => {
  const c=new GestureController();
  c.setTempoHand('Left');
  c.update([{hand:'Left',landmarks:hand(4,0.8)}],100);
  c.update([{hand:'Left',landmarks:hand(4,0.5)}],133);
  assert.ok(c.tempo>1);
  const tempo=c.tempo;
  c.update([{hand:'Right',landmarks:hand(0)}],166);
  assert.equal(c.bass,true); assert.equal(c.tempo,tempo);
  c.update([{hand:'Right',landmarks:hand(2,0.1)}],200);
  assert.ok(c.dynamics>0.85);
});
test('smoothing has equal response over equal elapsed time', () => {
  const once=smooth(0,1,100,70);
  let twice=smooth(0,1,50,70); twice=smooth(twice,1,50,70);
  assert.ok(Math.abs(once-twice)<1e-10);
});
test('invalid landmarks do not poison music parameters', () => {
  const c=new GestureController(); const p=hand(4); p[0].y=NaN;
  c.update([{hand:'Left',landmarks:p}],100);
  assert.equal(c.dynamics,0.85);
});

