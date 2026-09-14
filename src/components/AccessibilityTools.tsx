export function SkipToContent(){
  function focusMain(){
    const main=document.querySelector('main')
    if(main instanceof HTMLElement){main.tabIndex=-1;main.focus({preventScroll:true});main.scrollIntoView({block:'start'})}
  }
  return <button className="skipToContent" type="button" onClick={focusMain}>Pular para o conteúdo</button>
}

export function RouteLoading(){
  return <main className="routeLoading" role="status" aria-live="polite"><strong>Carregando iFarm Academy...</strong></main>
}
