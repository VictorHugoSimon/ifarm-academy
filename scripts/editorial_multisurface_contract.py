from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def text(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

checks = {
    'path': ('src/pages/PublicDiscoveryPage.tsx', 'surface="path"'),
    'instructor': ('src/pages/PublicDiscoveryPage.tsx', 'surface="instructor"'),
    'plan': ('src/pages/PublicPlansPage.tsx', 'surface="plan"'),
    'partner': ('src/pages/PublicPartnersBundlesPage.tsx', 'surface="partner"'),
    'bundle': ('src/pages/PublicPartnersBundlesPage.tsx', 'surface="bundle"'),
    'event': ('src/pages/PublicEventDetailPage.tsx', 'surface="event"'),
}
for surface, (path, marker) in checks.items():
    assert marker in text(path), f'{surface} contextual recommendation surface is not wired'

main = text('src/main.tsx')
assert 'publicEventDetailRoute' in main
assert '<PublicEventDetailPage />' in main

endpoint = text('functions/api/public/event/[id].ts')
assert 'meetingUrl:null' in endpoint, 'public event endpoint must suppress meeting URL'
assert 'registrationRequiresAuthentication:true' in endpoint
assert "e.status='published'" in endpoint

search = text('functions/api/public/search.ts')
assert 'href: `/events/${row.id}`' in search, 'event search result must open public event detail'

recommendations = text('functions/api/public/recommendations.ts')
assert "type==='event'?`/events/${item.id}`" in recommendations
assert "behavioralPersonalization:false" in recommendations
assert "commercialProfiling:false" in recommendations
assert "automaticLeadGeneration:false" in recommendations

loader = text('src/components/ContextualRecommendations.tsx')
assert 'loadPublicRecommendations' in loader
assert 'EditorialRecommendationRail' in loader

print('Editorial multisurface contract: PASS')
