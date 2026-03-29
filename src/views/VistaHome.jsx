import React from 'react';
import logoImg from '../Axon.png'; // Asegúrate de que la ruta a la imagen es correcta

export default function VistaHome({ onLaunchApp, lang, setLang }) {
  return (
    <div className="landing-container">
      {/* NAVBAR DE LA HOME */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src={logoImg} alt="Axon" className="axon-logo-glow" style={{ width: '45px', height: '45px' }} />
          <h2 style={{ margin: 0, fontSize: '24px', letterSpacing: '2px', fontWeight: '800' }}>AXON<span style={{color: 'var(--accent-glow)'}}>DAPP</span></h2>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="axon-input" style={{ width: 'auto', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <option value="es" style={{background: '#000'}}>🇪🇸 ES</option>
            <option value="en" style={{background: '#000'}}>🇺🇸 EN</option>
          </select>
          <button onClick={onLaunchApp} className="axon-btn-outline" style={{ padding: '10px 25px', fontWeight: 'bold' }}>
            {lang === 'es' ? 'Acceder a la Beta' : 'Enter Beta'}
          </button>
        </div>
      </nav>

      {/* HERO SECTION (El Gancho) */}
      <section className="hero-section">
        <span style={{ color: 'var(--valan-color)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '14px' }}>
          {lang === 'es' ? 'Impulsado por la comunidad' : 'Community Driven'}
        </span>
        <h1 className="hero-title">
          {lang === 'es' ? 'La Infraestructura Económica' : 'The Economic Infrastructure'}<br/>para Valannia.
        </h1>
        <p className="hero-subtitle">
          {lang === 'es' 
            ? 'Gestiona múltiples wallets, coordina la logística de tu gremio y opera en mercados P2P sin riesgo de estafas. Todo desde un único panel de control.'
            : 'Manage multiple wallets, coordinate your guild\'s logistics, and trade in P2P markets without scam risks. All from a single dashboard.'}
        </p>
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <button onClick={onLaunchApp} className="axon-btn-primary" style={{ padding: '15px 40px', fontSize: '18px', borderRadius: '30px' }}>
            {lang === 'es' ? 'Lanzar DApp' : 'Launch DApp'}
          </button>
          <button className="axon-btn-secondary" style={{ padding: '15px 40px', fontSize: '18px', borderRadius: '30px' }} onClick={() => window.open('https://polarisfuel.app', '_blank')}>
            Polaris Fuel
          </button>
        </div>
      </section>

      {/* FEATURES (Características) */}
      <section className="features-grid">
        <div className="glass-card feature-card">
          <span className="feature-icon">📦</span>
          <h3 style={{ color: '#fff' }}>{lang === 'es' ? 'Logística Multi-Cuenta' : 'Multi-Account Logistics'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            {lang === 'es' 
              ? 'Mueve miles de recursos entre tus wallets, la tesorería de tu gremio o zonas de guerra con un solo clic.'
              : 'Move thousands of resources between your wallets, guild treasury, or warzones with a single click.'}
          </p>
        </div>
        <div className="glass-card feature-card">
          <span className="feature-icon">⚖️</span>
          <h3 style={{ color: '#fff' }}>{lang === 'es' ? 'Mercado OTC Seguro' : 'Secure OTC Market'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            {lang === 'es' 
              ? 'Adiós a las estafas. Nuestro sistema Escrow bloquea los fondos y garantiza que ambos jugadores reciban lo acordado.'
              : 'Goodbye scams. Our Escrow system locks funds and guarantees both players receive what was agreed.'}
          </p>
        </div>
        <div className="glass-card feature-card">
          <span className="feature-icon">📊</span>
          <h3 style={{ color: '#fff' }}>{lang === 'es' ? 'Radar Blockchain' : 'Blockchain Radar'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            {lang === 'es' 
              ? 'Analíticas en tiempo real extraídas directamente de la red de Solana vía Helius para decisiones informadas.'
              : 'Real-time analytics extracted directly from the Solana network via Helius for informed decisions.'}
          </p>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="roadmap-section">
        <h2 style={{ textAlign: 'center', color: 'var(--accent-glow)', marginBottom: '50px', fontSize: '28px' }}>Roadmap</h2>
        
        <div className="roadmap-item completed">
          <div className="roadmap-marker">1</div>
          <div className="glass-card" style={{ flex: 1, padding: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>{lang === 'es' ? 'Beta Privada (Actual)' : 'Closed Beta (Current)'}</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              {lang === 'es' ? 'Despliegue de la infraestructura básica. Integración de Firebase y Helius. Testeo del mercado Escrow por miembros de La Mesa Redonda.' : 'Basic infrastructure deployment. Firebase and Helius integration. Escrow market testing by La Mesa Redonda members.'}
            </p>
          </div>
        </div>

        <div className="roadmap-item">
          <div className="roadmap-marker">2</div>
          <div className="glass-card" style={{ flex: 1, padding: '20px', opacity: 0.7 }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>{lang === 'es' ? 'Alianza Polaris & Apertura' : 'Polaris Alliance & Public Open'}</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              {lang === 'es' ? 'Integración como herramienta principal de gremios dentro de Polaris Fuel. Apertura del mercado OTC a todos los jugadores de Valannia.' : 'Integration as core guild tool inside Polaris Fuel. OTC market opens to all Valannia players.'}
            </p>
          </div>
        </div>

        <div className="roadmap-item">
          <div className="roadmap-marker">3</div>
          <div className="glass-card" style={{ flex: 1, padding: '20px', opacity: 0.4 }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>{lang === 'es' ? 'Automatización Total (API)' : 'Full Automation (API)'}</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              {lang === 'es' ? 'Integración con los Endpoints oficiales de Valannia. Crafteo masivo con un clic, gestión de Héroes y reclamación de recompensas.' : 'Integration with official Valannia Endpoints. One-click mass crafting, Hero management and reward claiming.'}
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '40px 20px', borderTop: '1px solid var(--border-color)', marginTop: '50px' }}>
        <img src={logoImg} alt="Axon" style={{ width: '30px', opacity: 0.5, marginBottom: '15px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          Axon Dapp © 2026. Built by <strong style={{color: 'var(--solana-color)'}}>Grimgorr</strong>.<br/>
          Not officially affiliated with Valannia (Yet).
        </p>
      </footer>
    </div>
  );
}