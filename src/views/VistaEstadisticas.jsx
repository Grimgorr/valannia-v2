import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const VALAN_MINT = "5cL3TVJ7p5ZKqyx16DXwpdcNx5u19vQtWujA9vYindi";
const TARGET_ADDRESS = "FutaNQMxqzyfScgW42Hbg71bPjkh5Rp7Tza4CiHFGoDT";
const HELIUS_API_KEY = "e7e26294-d604-4942-89fa-1ddf42912366";

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function VistaEstadisticas({ t, lang }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [isExtracting, setIsExtracting] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [dayStats, setDayStats] = useState({ in: 0, out: 0, net: 0 });

  useEffect(() => {
    const emptyData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
      emptyData.push({ name: dayStr, fees: 0, rewards: 0 });
    }
    setChartData(emptyData);
  }, [today, lang]);

  const fetchHeliusData = async (targetDateStr) => {
    setIsExtracting(true);
    const day = new Date(targetDateStr);
    const endTs = Math.floor(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) / 1000) + 86400;
    const startTs = endTs - (86400 * 7);

    let totalInTargetDay = 0, totalOutTargetDay = 0;
    const dailyInArray = Array(7).fill(0), dailyOutArray = Array(7).fill(0);
    let lastSig = "", searching = true;

    try {
      while (searching) {
        const url = `https://api.helius.xyz/v0/addresses/${TARGET_ADDRESS}/transactions?api-key=${HELIUS_API_KEY}${lastSig ? '&before=' + lastSig : ''}`;
        const response = await fetch(url);
        const txs = await response.json();
        if (!txs || txs.length === 0) break;

        for (let tx of txs) {
          lastSig = tx.signature;
          if (tx.timestamp < startTs) { searching = false; break; }
          if (tx.timestamp > endTs) continue;

          if (tx.tokenTransfers) {
            tx.tokenTransfers.forEach(tf => {
              if (tf.mint === VALAN_MINT) {
                const dayIndex = 6 - Math.floor((endTs - tx.timestamp) / 86400);
                if (dayIndex >= 0 && dayIndex <= 6) {
                    if (tf.toUserAccount === TARGET_ADDRESS) {
                        dailyInArray[dayIndex] += tf.tokenAmount;
                        if (dayIndex === 6) totalInTargetDay += tf.tokenAmount;
                    } else if (tf.fromUserAccount === TARGET_ADDRESS) {
                        dailyOutArray[dayIndex] += tf.tokenAmount;
                        if (dayIndex === 6) totalOutTargetDay += tf.tokenAmount;
                    }
                }
              }
            });
          }
        }
        if (txs.length < 10) break;
      }

      const finalChartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(day); d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
        finalChartData.push({ name: dayStr, fees: dailyInArray[6 - i], rewards: dailyOutArray[6 - i] });
      }

      setChartData(finalChartData);
      setDayStats({ in: totalInTargetDay, out: totalOutTargetDay, net: totalInTargetDay - totalOutTargetDay });
    } catch (e) { alert("Error consultando la blockchain."); } 
    finally { setIsExtracting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--accent-glow)', margin: '0 0 5px 0', fontSize: '22px' }}>{t('statTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>{t('statSubtitle')} <span style={{fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)'}}>{shortenAddress(TARGET_ADDRESS)}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('statSearchDate')}</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="axon-input" style={{ width: '150px' }} />
          </div>
          <button onClick={() => fetchHeliusData(selectedDate)} disabled={isExtracting || !selectedDate} className={`axon-btn-primary ${isExtracting ? 'disabled' : ''}`} style={{ height: '42px' }}>
            {isExtracting ? t('statBtnExtracting') : t('statBtnExtract')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
         <div className="glass-card" style={{ flex: 1, padding: '20px', textAlign: 'center', borderBottom: '4px solid #00ff88' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>{t('statCardIn')}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff88' }}>+{dayStats.in.toLocaleString(undefined, {minimumFractionDigits: 2})} <span style={{fontSize: '12px'}}>VALAN</span></div>
         </div>
         <div className="glass-card" style={{ flex: 1, padding: '20px', textAlign: 'center', borderBottom: '4px solid #00e5ff' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>{t('statCardOut')}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00e5ff' }}>-{dayStats.out.toLocaleString(undefined, {minimumFractionDigits: 2})} <span style={{fontSize: '12px'}}>VALAN</span></div>
         </div>
         <div className="glass-card" style={{ flex: 1, padding: '20px', textAlign: 'center', borderBottom: `4px solid ${dayStats.net >= 0 ? 'var(--solana-color)' : '#ff3366'}` }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>{t('statCardNet')}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: dayStats.net >= 0 ? 'var(--solana-color)' : '#ff3366' }}>
                {dayStats.net > 0 ? '+' : ''}{dayStats.net.toLocaleString(undefined, {minimumFractionDigits: 2})} <span style={{fontSize: '12px'}}>VALAN</span>
            </div>
         </div>
      </div>

      <div className="glass-card" style={{ flexGrow: 1, padding: '30px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '20px', fontSize: '14px', fontWeight: 'normal' }}>Tendencia últimos 7 días</h4>
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: '100%', minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff88" stopOpacity={0.5}/><stop offset="95%" stopColor="#00ff88" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorRewards" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.5}/><stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(13, 17, 31, 0.9)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: '8px' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}/>
                <Area type="monotone" dataKey="rewards" name={t('statCardOut')} stroke="#00e5ff" strokeWidth={3} fillOpacity={1} fill="url(#colorRewards)" />
                <Area type="monotone" dataKey="fees" name={t('statCardIn')} stroke="#00ff88" strokeWidth={3} fillOpacity={1} fill="url(#colorFees)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : ( <div className="empty-state" style={{ margin: 'auto' }}>{t('statNoData')}</div> )}
      </div>
    </div>
  );
}