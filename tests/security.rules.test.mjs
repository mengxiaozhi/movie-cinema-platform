import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Run with Firebase emulators; skip explicitly when emulator services are absent.
test('Firestore 拒絕所有客戶端寫入，包括自行升權與修改價格',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const {initializeTestEnvironment,assertFails}=await import('@firebase/rules-unit-testing');
  const {doc,setDoc,getDoc}=await import('firebase/firestore');
  const env=await initializeTestEnvironment({projectId:'demo-movie',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
  try{const client=env.authenticatedContext('attacker').firestore();await assertFails(setDoc(doc(client,'users/attacker'),{role:'super_admin'}));await assertFails(setDoc(doc(client,'cinemas/c1'),{dailyPrice:1}));await assertFails(getDoc(doc(client,'orders/private')));assert.ok(true);}finally{await env.cleanup();}
});

test('首頁公開讀取，草稿及發布只允許指定已驗證 Google 帳號',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
  const {initializeTestEnvironment,assertFails,assertSucceeds}=await import('@firebase/rules-unit-testing');
  const {doc,setDoc,getDoc}=await import('firebase/firestore');
  const {DEFAULT_HOME}=await import('../src/homepage.js');
  const env=await initializeTestEnvironment({projectId:'demo-movie',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
  try{
    const anon=env.unauthenticatedContext().firestore();
    const buyer=env.authenticatedContext('buyer',{email:'buyer@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
    const owner=env.authenticatedContext('owner',{email:'shiaufeng68@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
    await assertSucceeds(getDoc(doc(anon,'siteContent/home')));await assertFails(getDoc(doc(anon,'siteDrafts/home')));
    await assertFails(setDoc(doc(buyer,'siteContent/home'),DEFAULT_HOME));await assertSucceeds(setDoc(doc(owner,'siteDrafts/home'),DEFAULT_HOME));
    await assertSucceeds(setDoc(doc(owner,'siteContent/home'),DEFAULT_HOME));
    await assertFails(setDoc(doc(owner,'siteContent/home'),{slides:[{...DEFAULT_HOME.slides[0],url:'javascript:alert(1)'}]}));
    const unverified=env.authenticatedContext('fake',{email:'shiaufeng68@gmail.com',email_verified:false,firebase:{sign_in_provider:'google.com'}}).firestore();
    await assertFails(setDoc(doc(unverified,'siteContent/home'),DEFAULT_HOME));
  }finally{await env.cleanup();}
});
