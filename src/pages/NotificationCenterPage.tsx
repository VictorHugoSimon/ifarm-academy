import { useEffect, useState } from 'react'
import {
  loadNotificationPreferences,
  loadNotifications,
  updateNotification,
  updateNotificationPreference,
  type AcademyNotification,
  type NotificationCategory,
  type NotificationPreference,
  type NotificationStatus,
} from '../services/notificationApi'
import '../styles/notifications.css'

const categoryLabel: Record<NotificationCategory,string> = {
  academic: 'Acadêmico', compliance: 'Compliance', event: 'Eventos', commercial: 'Comercial', system: 'Sistema',
}

export function NotificationCenterPage() {
  const [items, setItems] = useState<AcademyNotification[]>([])
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [status, setStatus] = useState<NotificationStatus | ''>('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [message, setMessage] = useState('')

  async function refresh(nextStatus: NotificationStatus | '' = status) {
    try {
      const [inbox, prefs] = await Promise.all([loadNotifications(nextStatus || undefined), loadNotificationPreferences()])
      setItems(inbox.data); setUnreadCount(inbox.unreadCount); setPreferences(prefs)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as notificações.') }
  }

  useEffect(() => { void refresh('') }, [])

  async function changeStatus(next: NotificationStatus | '') {
    setStatus(next); await refresh(next)
  }

  async function act(action: 'mark_read'|'archive'|'mark_all_read', id?: string) {
    try { await updateNotification(action, id); await refresh(); setMessage('Central atualizada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao atualizar notificação.') }
  }

  async function togglePreference(category: NotificationCategory, enabled: boolean) {
    try { await updateNotificationPreference(category, enabled); await refresh(); setMessage('Preferência atualizada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao atualizar preferência.') }
  }

  return <div className="notificationPage">
    <div className="pageHeader"><div><h1>Notificações</h1><p>Central in-app da Academy. Canais externos permanecem desligados até integração homologada com o iFarm Core.</p>{message && <small>{message}</small>}</div></div>

    <section className="notificationMetrics">
      <article><span>Não lidas</span><strong>{unreadCount}</strong></article>
      <article><span>Exibidas</span><strong>{items.length}</strong></article>
      <article><span>E-mail</span><strong>Desligado</strong></article>
      <article><span>Push</span><strong>Desligado</strong></article>
    </section>

    <section className="panel notificationToolbar">
      <div className="notificationFilters">
        {([['','Todas'],['unread','Não lidas'],['read','Lidas'],['archived','Arquivadas']] as const).map(([value,label]) => <button key={value || 'all'} className={status === value ? 'active' : ''} onClick={() => void changeStatus(value)}>{label}</button>)}
      </div>
      <button disabled={!unreadCount} onClick={() => void act('mark_all_read')}>Marcar todas como lidas</button>
    </section>

    <section className="panel">
      <div className="panelTitle"><h2>Inbox</h2><span>{items.length} itens</span></div>
      <div className="notificationList">{items.map((item) => <article key={item.id} className={`${item.status} ${item.priority}`}>
        <div><small>{categoryLabel[item.category]} · {new Date(item.createdAt).toLocaleString('pt-BR')}</small><h3>{item.title}</h3><p>{item.message}</p>{item.required && <span className="notificationRequired">Obrigatória</span>}</div>
        <div className="notificationActions">{item.status === 'unread' && <button onClick={() => void act('mark_read', item.id)}>Marcar como lida</button>}{item.status !== 'archived' && <button onClick={() => void act('archive', item.id)}>Arquivar</button>}</div>
      </article>)}</div>
      {!items.length && <p>Nenhuma notificação neste filtro.</p>}
    </section>

    <section className="panel">
      <div className="panelTitle"><h2>Preferências in-app</h2><span>E-mail e push ainda indisponíveis</span></div>
      <div className="notificationPreferences">{preferences.map((pref) => <label key={pref.category}><span><strong>{categoryLabel[pref.category]}</strong><small>Receber na central da Academy</small></span><input type="checkbox" checked={pref.inAppEnabled} onChange={(e) => void togglePreference(pref.category, e.target.checked)} /></label>)}</div>
      <p className="notificationFootnote">Notificações marcadas como obrigatórias podem ignorar preferências quando forem necessárias por segurança ou operação. A v0.38 ainda não dispara canais externos.</p>
    </section>
  </div>
}
