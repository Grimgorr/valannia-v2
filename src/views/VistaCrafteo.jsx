import React, { useState, useEffect, useMemo } from 'react';

function HeroCard({ hero, t }) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchImg = async () => {
      if (hero.item?.solana?.uri) {
        try {
          const res = await fetch(hero.item.solana.uri);
          const data = await res.json();
          if (isMounted && data.image) setImgSrc(data.image);
        } catch (e) {}
      }
    };
    fetchImg();
    return () => { isMounted = false };
  }, [hero]);

  const fallbackImg = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${hero.item.kind}&backgroundColor=020617`;

  return (
    <div className="hero-card">
      <div className="hero-img-container"><img src={imgSrc || fallbackImg} alt={hero.item.kind} className="hero-img" /></div>
      <h4 className="hero-title">{hero.item.kind}</h4>
      <div className="hero-stats">
        <div className="stat-row"><span className="stat-label">{t('craftProfession')}</span><span className="stat-value">{hero.item.attributes.hero.profession}</span></div>
        <div className="stat-row"><span className="stat-label">{t('craftLevel')}</span><span className="stat-value">{hero.item.attributes.hero.level}</span></div>
      </div>
    </div>
  );
}

export default function VistaCrafteo({ cuentas, burner, t, lang }) {
  const [selectedCuenta, setSelectedCuenta] = useState("");
  const [misHeroes, setMisHeroes] = useState([]);
  
  const cuentasRender = useMemo(() => {
    if (burner) return [{ alias: "🔥 Burn Wallet", direccion: burner.publicKey.toBase58(), isBurner: true }, ...cuentas];
    return cuentas;
  }, [cuentas, burner]);

  const generarHeroesSimulados = (walletAddress) => {
    const baseHeroes = [
        { "id": "1", "item": { "id": "1", "kind": "Phylune", "attributes": { "hero": { "level": 12, "profession": "Architect" } }, "solana": { "uri": "https://valanniaitemsbucket.s3.eu-north-1.amazonaws.com/metadata/beyond/1389.json" } } },
        { "id": "2", "item": { "id": "2", "kind": "Akheton", "attributes": { "hero": { "level": 13, "profession": "Blacksmith" } }, "solana": { "uri": "https://valanniaitemsbucket.s3.eu-north-1.amazonaws.com/metadata/beyond/2413.json" } } },
        { "id": "3", "item": { "id": "3", "kind": "Razuzel", "attributes": { "hero": { "level": 12, "profession": "Engineer" } }, "solana": { "uri": "https://s3.eu-north-1.amazonaws.com/valanniaawsbucket/DL26NkiAFZxqctzUe8Tg" } } }
    ];

    let hash = 0;
    for (let i = 0; i < walletAddress.length; i++) hash = walletAddress.charCodeAt(i) + ((hash << 5) - hash);
    hash = Math.abs(hash);

    if (hash % 2 === 0) return baseHeroes;

    const profesiones = ["Miner", "Alchemist", "Explorer", "Artisan"];
    const razas = ["Altari", "Tyxen", "Pirate"];
    
    return baseHeroes.slice(0, (hash % 3) + 1).map((h, i) => ({
        ...h, id: `fake-${hash}-${i}`,
        item: { ...h.item, kind: razas[i % 3], attributes: { hero: { level: (hash % 20) + 1, profession: profesiones[i % 4] } }, solana: {} }
    }));
  };

  useEffect(() => {
    if (selectedCuenta) setMisHeroes(generarHeroesSimulados(selectedCuenta));
    else setMisHeroes([]);
  }, [selectedCuenta]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="alert-banner" style={{ border: '1px solid var(--solana-color)', color: 'var(--solana-color)', background: 'rgba(255,204,0,0.05)' }}>
        🚧 {lang === 'es' ? "MODO SIMULADOR DE CRAFTEO" : "CRAFTING SIMULATOR MODE"}
      </div>
      <div className="glass-card" style={{ padding: '30px', flexGrow: 1, marginTop: '20px' }}>
        <h3 style={{ color: 'var(--accent-glow)', margin: '0 0 25px 0', fontSize: '22px' }}>{t('craftTitle')}</h3>
        <select value={selectedCuenta} onChange={(e) => setSelectedCuenta(e.target.value)} className="axon-input" style={{ maxWidth: '350px', marginBottom: '30px' }}>
            <option value="">{t('craftSelectAcc')}</option>
            {cuentasRender.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}
        </select>
        {selectedCuenta && misHeroes.length === 0 && ( <div className="empty-state">{t('craftNoHeroes')}</div> )}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {misHeroes.map((h, i) => ( <HeroCard key={i} hero={h} t={t} /> ))}
        </div>
      </div>
    </div>
  );
}