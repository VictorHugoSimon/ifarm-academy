import { FormEvent, useEffect, useState } from 'react'
import {
  activateGamificationRule,
  createGamificationBadge,
  createGamificationLevel,
  loadGamificationBadges,
  loadGamificationLevels,
  loadGamificationPermissions,
  loadGamificationProfile,
  loadGamificationRules,
  type GamificationEventType,
  type GamificationProfile,
} from '../services/gamificationApi'
import '../styles/gamification.css'

const eventLabels: Record<GamificationEventType,string> = {
  lesson_completed: 'Aula concluída',
  course_completed: 'Curso concluído',
  quiz_approved: 'Avaliação aprovada',
  certificate_issued: 'Certificado emitido',
  event_attended: 'Evento frequentado',
  smart_farm_activity: 'Atividade Smart Farm',
}

const eventTypes = Object.keys(eventLabels) as GamificationEventType[]

export function GamificationPage() {
  const [profile, setProfile] = useState<GamificationProfile | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [rules, setRules] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [ruleForm, setRuleForm] = useState({ eventType: 'lesson_completed' as GamificationEventType, points: '', rationale: '' })
  const [badgeForm, setBadgeForm] = useState({ code: '', title: '', description: '', criterionType: 'xp_total' as 'xp_total'|'event_count', criterionEventType: 'course_completed' as GamificationEventType, criterionValue: '' })
  const [levelForm, setLevelForm] = useState({ name: '', minXp: '', position: '' })

  async function refresh() {
    try {
      const [profileData, permissions] = await Promise.all([loadGamificationProfile(), loadGamificationPermissions()])
      setProfile(profileData); setCanManage(permissions.canManage)
      if (permissions.canManage) {
        const [ruleData, badgeData, levelData] = await Promise.all([loadGamificationRules(), loadGamificationBadges(), loadGamificationLevels()])
        setRules(ruleData); setBadges(badgeData); setLevels(levelData)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a gamificação.')
    }
  }

  useEffect(() => { void refresh() }, [])

  async function saveRule(event: FormEvent) {
    event.preventDefault()
    try {
      await activateGamificationRule({ eventType: ruleForm.eventType, points: Number(ruleForm.points), rationale: ruleForm.rationale.trim() })
      setRuleForm({ ...ruleForm, points: '', rationale: '' }); await refresh(); setMessage('Regra de XP versionada e ativada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar regra.') }
  }

  async function saveBadge(event: FormEvent) {
    event.preventDefault()
    try {
      await createGamificationBadge({
        code: badgeForm.code,
        title: badgeForm.title,
        description: badgeForm.description,
        criterionType: badgeForm.criterionType,
        criterionEventType: badgeForm.criterionType === 'event_count' ? badgeForm.criterionEventType : null,
        criterionValue: Number(badgeForm.criterionValue),
      })
      setBadgeForm({ ...badgeForm, code: '', title: '', description: '', criterionValue: '' }); await refresh(); setMessage('Badge criado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar badge.') }
  }

  async function saveLevel(event: FormEvent) {
    event.preventDefault()
    try {
      await createGamificationLevel({ name: levelForm.name.trim(), minXp: Number(levelForm.minXp), position: Number(levelForm.position) })
      setLevelForm({ name: '', minXp: '', position: '' }); await refresh(); setMessage('Nível criado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar nível.') }
  }

  return <div className="gamificationPage">
    <div className="pageHeader"><div><h1>Gamificação</h1><p>XP, níveis, badges e sequência de estudos sem interferir em notas, certificados ou compliance.</p>{message && <small>{message}</small>}</div></div>

    <section className="gamificationMetrics">
      <article><span>XP acumulado</span><strong>{profile?.totalXp ?? 0}</strong></article>
      <article><span>Nível atual</span><strong>{profile?.level?.name ?? 'Não configurado'}</strong></article>
      <article><span>Sequência atual</span><strong>{profile?.streak.currentDays ?? 0} dias</strong></article>
      <article><span>Melhor sequência</span><strong>{profile?.streak.bestDays ?? 0} dias</strong></article>
    </section>

    {profile?.nextLevel && <section className="panel"><div className="panelTitle"><h2>Próximo nível</h2><span>{profile.nextLevel.remainingXp} XP restantes</span></div><p>{profile.nextLevel.name} · meta de {profile.nextLevel.minXp} XP</p></section>}

    <section className="panel"><div className="panelTitle"><h2>Conquistas</h2><span>{profile?.badges.length ?? 0} badges</span></div><div className="badgeGrid">{profile?.badges.map((badge) => <article key={badge.id}><strong>{badge.title}</strong><span>{badge.description}</span><small>{new Date(badge.awarded_at).toLocaleDateString('pt-BR')}</small></article>)}</div>{!profile?.badges.length && <p>Nenhuma conquista ainda.</p>}</section>

    <section className="panel"><div className="panelTitle"><h2>Atividade recente</h2><span>Últimos eventos pontuados</span></div><div className="activityList">{profile?.recentActivity.map((item, index) => <div key={`${item.source_id}-${index}`}><span>{eventLabels[item.event_type] ?? item.event_type}</span><strong>+{item.points} XP</strong><small>{new Date(item.occurred_at).toLocaleString('pt-BR')}</small></div>)}</div>{!profile?.recentActivity.length && <p>Sem eventos pontuados. Regras podem ainda não estar configuradas.</p>}</section>

    {canManage && <div className="gamificationAdmin">
      <form className="panel" onSubmit={saveRule}><div className="panelTitle"><h2>Regras de XP</h2><span>{rules.filter((item) => item.status === 'active').length} ativas</span></div>
        <label>Evento<select value={ruleForm.eventType} onChange={(e) => setRuleForm({ ...ruleForm, eventType: e.target.value as GamificationEventType })}>{eventTypes.map((type) => <option key={type} value={type}>{eventLabels[type]}</option>)}</select></label>
        <label>XP<input required type="number" min="0" step="1" value={ruleForm.points} onChange={(e) => setRuleForm({ ...ruleForm, points: e.target.value })} /></label>
        <label>Justificativa<textarea required value={ruleForm.rationale} onChange={(e) => setRuleForm({ ...ruleForm, rationale: e.target.value })} /></label>
        <button className="primary">Ativar nova versão</button>
      </form>

      <form className="panel" onSubmit={saveBadge}><div className="panelTitle"><h2>Badges</h2><span>{badges.filter((item) => item.status === 'active').length} ativos</span></div>
        <label>Código<input required value={badgeForm.code} onChange={(e) => setBadgeForm({ ...badgeForm, code: e.target.value.toUpperCase() })} /></label>
        <label>Título<input required value={badgeForm.title} onChange={(e) => setBadgeForm({ ...badgeForm, title: e.target.value })} /></label>
        <label>Descrição<textarea value={badgeForm.description} onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })} /></label>
        <label>Critério<select value={badgeForm.criterionType} onChange={(e) => setBadgeForm({ ...badgeForm, criterionType: e.target.value as 'xp_total'|'event_count' })}><option value="xp_total">XP acumulado</option><option value="event_count">Quantidade de eventos</option></select></label>
        {badgeForm.criterionType === 'event_count' && <label>Evento<select value={badgeForm.criterionEventType} onChange={(e) => setBadgeForm({ ...badgeForm, criterionEventType: e.target.value as GamificationEventType })}>{eventTypes.map((type) => <option key={type} value={type}>{eventLabels[type]}</option>)}</select></label>}
        <label>Meta<input required type="number" min="1" step="1" value={badgeForm.criterionValue} onChange={(e) => setBadgeForm({ ...badgeForm, criterionValue: e.target.value })} /></label>
        <button className="primary">Criar badge</button>
      </form>

      <form className="panel" onSubmit={saveLevel}><div className="panelTitle"><h2>Níveis</h2><span>{levels.filter((item) => item.status === 'active').length} ativos</span></div>
        <label>Nome<input required value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} /></label>
        <label>XP mínimo<input required type="number" min="0" step="1" value={levelForm.minXp} onChange={(e) => setLevelForm({ ...levelForm, minXp: e.target.value })} /></label>
        <label>Ordem<input required type="number" min="0" step="1" value={levelForm.position} onChange={(e) => setLevelForm({ ...levelForm, position: e.target.value })} /></label>
        <button className="primary">Criar nível</button>
      </form>
    </div>}
  </div>
}
