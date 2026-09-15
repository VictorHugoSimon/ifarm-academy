import { useEffect, useMemo, useState } from 'react'
import { createLocalCheckout, formatCheckoutAmount, listMyCheckoutSessions, startProviderCheckout, type CheckoutSession, type PaymentProviderReadiness } from '../services/checkoutApi'
import { formatPlanPrice, loadPublicPlans, type PublicPlan } from '../services/publicPortalApi'

const statusLabel: Record<CheckoutSession['status'], string> = {
  created: 'Preparado',
  awaiting_provider: 'Conectando ao pagamento',
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  expired: 'Expirado',
}

export function SubscriptionCheckoutPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [checkouts, setCheckouts] = useState<CheckoutSession[]>([])
  const [provider, setProvider] = useState<PaymentProviderReadiness | null>(null)
  const [intervalByPlan, setIntervalByPlan] = useState<Record<string, 'monthly' | 'annual'>>({})
  const [busyPlan, setBusyPlan] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    const [publicPlans, sessions] = await Promise.all([loadPublicPlans(), listMyCheckoutSessions()])
    setPlans(publicPlans.data.filter((plan) => plan.commercialMode === 'priced'))
    setCheckouts(sessions.data)
    setProvider(sessions.provider)
  }

  useEffect(() => {
    void reload().catch((reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar assinaturas.'))
  }, [])

  const eligiblePlans = useMemo(() => plans.filter((plan) =>
    plan.audienceType === 'individual' && plan.prices.some((price) => price.priceUnit === 'subscription' && price.currency.toUpperCase() === 'BRL'),
  ), [plans])

  async function subscribe(plan: PublicPlan) {
    setError(''); setMessage(''); setBusyPlan(plan.id)
    try {
      if (!provider?.checkoutEnabled) throw new Error(provider?.reason || 'Checkout ainda não está habilitado neste ambiente.')
      const available = plan.prices.filter((price) => price.priceUnit === 'subscription' && price.currency.toUpperCase() === 'BRL')
      const requested = intervalByPlan[plan.id] ?? (available.some((price) => price.billingInterval === 'monthly') ? 'monthly' : 'annual')
      const price = available.find((item) => item.billingInterval === requested)
      if (!price) throw new Error('A condição escolhida não está disponível.')

      const local = await createLocalCheckout(plan.id, requested)
      const external = await startProviderCheckout(local.data.id)
      await reload()
      if (!external.data.checkoutUrl) throw new Error('O provider não retornou uma URL de pagamento válida.')
      setMessage('Checkout criado com segurança. Redirecionando para o Mercado Pago...')
      window.location.assign(external.data.checkoutUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a assinatura.')
    } finally {
      setBusyPlan('')
    }
  }

  return <section className="builderPage" aria-labelledby="subscription-checkout-title">
    <header className="builderHeader">
      <div><small>Planos e cobrança</small><h2 id="subscription-checkout-title">Minha assinatura</h2><p>O valor vem do preço publicado no servidor. Dados de pagamento são tratados pelo Mercado Pago; a Academy só libera acesso depois da confirmação verificada.</p></div>
      <button onClick={() => void reload()}>Atualizar</button>
    </header>

    {provider && <div className={`inlineNotice ${provider.checkoutEnabled ? 'success' : ''}`}><strong>{provider.checkoutEnabled ? 'Checkout disponível' : 'Checkout bloqueado com segurança'}</strong><p>{provider.reason}</p></div>}
    {error && <div className="inlineNotice error"><strong>Não foi possível continuar</strong><p>{error}</p></div>}
    {message && <div className="inlineNotice success"><p>{message}</p></div>}

    <div className="builderGrid">
      {eligiblePlans.map((plan) => {
        const prices = plan.prices.filter((price) => price.priceUnit === 'subscription' && price.currency.toUpperCase() === 'BRL')
        const interval = intervalByPlan[plan.id] ?? (prices.some((price) => price.billingInterval === 'monthly') ? 'monthly' : 'annual')
        const selected = prices.find((price) => price.billingInterval === interval) ?? prices[0]
        return <article className="builderCard" key={plan.id}>
          <small>{plan.audienceType === 'individual' ? 'Individual' : plan.audienceType}</small>
          <h3>{plan.name}</h3><p>{plan.description}</p>
          {prices.length > 1 && <div className="fieldRow"><label>Periodicidade<select value={interval} onChange={(event) => setIntervalByPlan((current) => ({ ...current, [plan.id]: event.target.value as 'monthly' | 'annual' }))}>{prices.map((price) => <option key={price.id} value={price.billingInterval}>{price.billingInterval === 'monthly' ? 'Mensal' : 'Anual'}</option>)}</select></label></div>}
          {selected && <p><strong>{formatPlanPrice(selected)}</strong></p>}
          <button className="primary" disabled={!provider?.checkoutEnabled || busyPlan === plan.id} onClick={() => void subscribe(plan)}>{busyPlan === plan.id ? 'Preparando...' : 'Assinar com Mercado Pago'}</button>
          {!plan.checkoutReady && <small>Este plano só ficará liberado para checkout quando o ambiente de pagamento estiver homologado.</small>}
        </article>
      })}
      {!eligiblePlans.length && <article className="builderCard"><h3>Nenhum plano individual disponível</h3><p>Planos corporativos por usuário continuam sujeitos à política comercial de licenças e não são cobrados por este fluxo.</p></article>}
    </div>

    <div className="builderCard">
      <h3>Histórico de checkout</h3>
      {!checkouts.length && <p>Nenhuma tentativa de assinatura registrada.</p>}
      {checkouts.map((checkout) => <div className="listRow" key={checkout.id}><div><strong>{statusLabel[checkout.status]}</strong><small>{new Date(checkout.createdAt).toLocaleString('pt-BR')} · {checkout.billingInterval === 'monthly' ? 'mensal' : 'anual'}</small></div><strong>{formatCheckoutAmount(checkout.amountCents, checkout.currency)}</strong></div>)}
    </div>
  </section>
}
