// Cole no Console do Maré dev ou Radar dev. Só leitura; não grava nem mostra nomes.
(()=>{
  const F=window.MareFerias;
  if(!F){console.table([{teste:'Módulo de férias carregado',resultado:'❌'}]);return;}
  const radar=typeof _okrFeriasSelo==='function';
  const selo=radar?_okrFeriasSelo:_FeriasSelo;
  const usuarios=radar?_globalUsersCache:(window._allUsersRaw||{});
  const hoje=F.hojeSP(), testes=[];
  const t=(teste,ok)=>testes.push({teste,resultado:ok?'✅':'❌'});
  t('Data de São Paulo em formato ISO',/^\d{4}-\d{2}-\d{2}$/.test(hoje));
  let paridade=true,selos=true,proximas=true;
  for(const [uid,u]of Object.entries(usuarios)){
    const atual=F.ausente(uid,hoje),proximo=F.periodoDe(uid);
    if(u.init) paridade &&= JSON.stringify(F.ausente(u.init,hoje))===JSON.stringify(atual);
    selos &&= !!selo(uid)===!!atual;
    proximas &&= !proximo || proximo.fim>=hoje;
  }
  t('Inicial e uid concordam',paridade);
  t('Selo somente para quem está fora hoje',selos);
  t('Próximo período não terminou no passado',proximas);
  t('Pessoa inexistente não tem selo',selo('__f3_inexistente__')==='');
  console.table(testes);
})();
