function test() {
  const ta = { value: "Hello @card: Pmax ", selectionStart: 18 };
  const val = ta.value;
  const pos = ta.selectionStart;
  let atPos = -1;
  for(let i=pos-1; i>=0; i--){
    if(val[i]==='\n') break;
    if(val[i]==='@'){
      const querySoFar = val.slice(i, pos).toLowerCase();
      if(querySoFar.startsWith('@card:') || !/\s/.test(val.slice(i+1, pos))){
        atPos = i;
      }
      break;
    }
  }
  console.log(atPos, atPos >= 0 ? val.slice(atPos+1, pos) : null);
}
test();
