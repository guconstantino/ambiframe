/**
 * AmbiFrame - Wallpapers & Calibration Engine
 * 5 Wallpapers diários de alta resolução (Unsplash 4K + 5 Bundled Offline Fallback)
 */

(function() {
  // 5 Wallpapers locais embutidos (garantia offline e zero tráfego obrigatório)
  const BUNDLED_WALLPAPERS = [
    "assets/wallpapers/jeremy-bishop-2e3hgvDnCpM-unsplash.jpg",
    "assets/wallpapers/joel-filipe-QwoNAhbmLLo-unsplash.jpg",
    "assets/wallpapers/kyaw-tun-k6BHLfw_jUg-unsplash.jpg",
    "assets/wallpapers/luca-micheli-ruWkmt3nU58-unsplash.jpg",
    "assets/wallpapers/francesco-ungaro-1fzbUyzsHV8-unsplash.jpg"
  ];

  // Catálogo curado de 50 fotografias paisagísticas 4K do Unsplash
  const UNSPLASH_4K_CATALOG = [
    { id: "1506744038136-46273834b3fb", author: "Bailey Zindel", title: "Yosemite Valley" },
    { id: "1519681393784-d120267933ba", author: "Benjamin Davies", title: "Starry Mountain Night" },
    { id: "1470071459604-3b5ec3a7fe05", author: "Kalen Emsley", title: "Morning Fog over Pines" },
    { id: "1472214103451-9374bd1c798e", author: "Roagan Thomson", title: "Green Rolling Hills" },
    { id: "1464822759023-fed622ff2c3b", author: "Kalina Georgieva", title: "Alpine Peaks" },
    { id: "1497436072909-60f360e1d4b1", author: "Luca Bravo", title: "Lago di Braies" },
    { id: "1507525428034-b723cf961d3e", author: "Sean Oulashin", title: "Tropical Calm Beach" },
    { id: "1518495973542-4542c06a5843", author: "Jeremy Bishop", title: "Sunbeams in Rainforest" },
    { id: "1441974231531-c6227db76b6e", author: "Lukasz Szmigiel", title: "Autumn Birch Grove" },
    { id: "1511497584788-87676104235f", author: "Kieran Sheehan", title: "Mystic Forest" },
    { id: "1470240731273-7821a6eeb6bd", author: "Vadim Sherbakov", title: "Dolomites Sunset" },
    { id: "1469854523086-cc02fe5d8800", author: "Leio McLaren", title: "Red Desert Canyons" },
    { id: "1477346611705-65d1883cee1e", author: "Dustin Lee", title: "Snowy Pine Valley" },
    { id: "1433086966358-54859d0ed716", author: "Luca Bravo", title: "Hidden Waterfall" },
    { id: "1426604966848-d7adac402bff", author: "Will van Wingerden", title: "Green Mountain Ridge" },
    { id: "1501785888041-af3ef285b470", author: "Pietro De Grandi", title: "Norwegian Fjords" },
    { id: "1508739773434-c26b3d09e071", author: "Cristina Gottardi", title: "Silent Alpine Peaks" },
    { id: "1475921088768-304f80cadd91", author: "Karsten Würth", title: "Twilight Shore" },
    { id: "1534447677768-be436bb09401", author: "Austin Schmid", title: "Milky Way Galaxy" },
    { id: "1518709268805-4e9042af9f23", author: "Greg Rakozy", title: "Cosmic Sky" },
    { id: "1542273917363-3b1817f69a2d", author: "Casey Horner", title: "Ancient Redwood Fog" },
    { id: "1513836279014-a89f7a76ae86", author: "Federico Respini", title: "Blue Moonlight Mountain" },
    { id: "1493246507139-91e8fad9978e", author: "Kalina Georgieva", title: "Frozen Alps Sunrise" },
    { id: "1509316975850-ff9c5deb0cd9", author: "Cliford Mervil", title: "Golden Dune Shadows" }
  ];

  function getTodaySeed() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function hashSeed(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Gera a seleção determinística de 5 fotos para hoje
  function resolveDailyWallpapers() {
    const seed = getTodaySeed();
    const seedNum = hashSeed(seed);
    const selected = [];

    for (let i = 0; i < 5; i++) {
      const idx = (seedNum + i * 7) % UNSPLASH_4K_CATALOG.length;
      const item = UNSPLASH_4K_CATALOG[idx];
      selected.push({
        url: `https://images.unsplash.com/photo-${item.id}?w=3840&q=85&auto=format&fit=crop`,
        thumb: `https://images.unsplash.com/photo-${item.id}?w=360&q=70&auto=format&fit=crop`,
        author: item.author,
        title: item.title,
        fallback: BUNDLED_WALLPAPERS[i % BUNDLED_WALLPAPERS.length]
      });
    }
    return selected;
  }

  const dailyList = resolveDailyWallpapers();

  // Lista principal usada pelo app (URLs 4K)
  window.DAILY_WALLPAPERS_METADATA = dailyList;
  window.BUNDLED_WALLPAPERS = BUNDLED_WALLPAPERS;

  // window.WALLPAPERS com as 5 fotos de hoje (com URLs online e fallback local)
  window.WALLPAPERS = dailyList.map(item => item.url);

  // Configurações tipográficas e de posicionamento elegante (Gestalt)
  window.WALLPAPER_CONFIGS = {};
  
  // Configurações padrão refinadas para as fotos do dia
  window.WALLPAPERS.forEach((url, i) => {
    window.WALLPAPER_CONFIGS[url] = {
      position: i % 2 === 0 ? "pos-top-left" : "pos-top-center",
      layout: "layout-horizontal",
      fontSize: "230px",
      metaSize: "22px",
      color: "#ffffff",
      shadow: "0 18px 80px rgba(0, 0, 0, 0.95), 0 0 50px rgba(56, 189, 248, 0.40)",
      fontFamily: "'Outfit', sans-serif"
    };
  });

  // Também registra as configs para os fallbacks locais
  BUNDLED_WALLPAPERS.forEach((path, i) => {
    window.WALLPAPER_CONFIGS[path] = {
      position: "pos-top-left",
      layout: "layout-horizontal",
      fontSize: "230px",
      metaSize: "22px",
      color: "#ffffff",
      shadow: "0 18px 80px rgba(0, 0, 0, 0.95), 0 0 50px rgba(255, 255, 255, 0.35)",
      fontFamily: "'Outfit', sans-serif"
    };
  });
})();
