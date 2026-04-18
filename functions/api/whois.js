/**
 * Cloudflare Pages Function — RDAP domain lookup proxy
 * GET /api/whois?domain=example.com
 *
 * Uses the free, public RDAP protocol (WHOIS successor, IETF standard)
 * No API key needed. Zero cost.
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawDomain = (url.searchParams.get('domain') || '').trim().toLowerCase();

  // Strip protocol & path — keep only hostname
  let domain = rawDomain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return jsonResponse(400, { error: '請輸入有效的網址，例如 example.com' });
  }

  try {
    // Try RDAP first (preferred — structured JSON)
    // 根據 TLD 選擇 RDAP 端點
    let rdapUrl = `https://rdap.org/domain/${domain}`;
    if (domain.endsWith('.tw')) rdapUrl = `https://ccrdap.twnic.tw/tw/domain/${domain}`;
    else if (domain.endsWith('.cn')) rdapUrl = `https://rdap.cnnic.cn/rdap/domain/${domain}`;
    else if (domain.endsWith('.jp')) rdapUrl = `https://rdap.jprs.jp/rdap/domain/${domain}`;
    else if (domain.endsWith('.kr')) rdapUrl = `https://rdap.kisa.or.kr/rdap/domain/${domain}`;

    const rdapRes = await fetch(rdapUrl, {
      headers: { Accept: 'application/rdap+json' },
      cf: { cacheTtl: 3600 },           // CF edge cache 1 hr
    });

    if (!rdapRes.ok) {
      return jsonResponse(404, { error: `查無此網域資訊：${domain}` });
    }

    const data = await rdapRes.json();

    // Extract dates from RDAP events array
    const events = data.events || [];
    const regEvent = events.find(e => e.eventAction === 'registration');
    const expEvent = events.find(e => e.eventAction === 'expiration');
    const updEvent = events.find(e => e.eventAction === 'last changed');

    const registrationDate = regEvent?.eventDate || null;
    const expirationDate = expEvent?.eventDate || null;
    const lastUpdated = updEvent?.eventDate || null;

    // Registrar info
    const registrarEntity = (data.entities || []).find(
      e => (e.roles || []).includes('registrar')
    );
    const registrar = registrarEntity?.vcardArray?.[1]
      ?.find(v => v[0] === 'fn')?.[3]
      || registrarEntity?.handle
      || '未知';

    // Calculate domain age
    let ageMonths = null;
    let ageLabel = '未知';
    let riskLevel = 'unknown';

    if (registrationDate) {
      const regDate = new Date(registrationDate);
      const now = new Date();
      ageMonths = Math.floor((now - regDate) / (1000 * 60 * 60 * 24 * 30.44));

      if (ageMonths < 6) {
        riskLevel = 'danger';
        ageLabel = `${ageMonths} 個月（⚠️ 高風險）`;
      } else if (ageMonths < 24) {
        riskLevel = 'warning';
        ageLabel = `${ageMonths} 個月（⚡ 需警覺）`;
      } else {
        const years = Math.floor(ageMonths / 12);
        const remainMonths = ageMonths % 12;
        riskLevel = 'safe';
        ageLabel = `${years} 年 ${remainMonths} 個月（✅ 相對安全）`;
      }
    }

    // Privacy protection detection
    const nameServer = (data.nameservers || []).map(ns => ns.ldhName).filter(Boolean);
    const status = data.status || [];

    return jsonResponse(200, {
      domain,
      registrationDate,
      expirationDate,
      lastUpdated,
      registrar,
      ageMonths,
      ageLabel,
      riskLevel,
      status,
      nameServer: nameServer.slice(0, 4),
    });

  } catch (err) {
    return jsonResponse(500, { error: '查詢失敗，請稍後再試。' });
  }
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
