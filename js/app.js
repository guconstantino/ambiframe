/**
 * Ambient TV - Engine v0.9.16
 * Card Mestre Unificado, Streaming & Notícias com Previews Visuais
 * Modais Cinemáticos com Ficha Técnica Completa, Trailer Interativo & Deep Linking
 */

const savedGeo = (() => {
  try {
    const s = localStorage.getItem("ambiframe_geo");
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
})();

const userGeo = savedGeo || ((window.LOCAL_CONFIG && window.LOCAL_CONFIG.geo) ? window.LOCAL_CONFIG.geo : {});

const CONFIG = {
  latitude: userGeo.lat || -23.3103,
  longitude: userGeo.lon || -51.1628,
  locationName: userGeo.address || "Londrina, PR",
  bairro: userGeo.bairro || "",

  weatherUpdateInterval: 15 * 60 * 1000, // 15 minutos
  financeUpdateInterval: 5 * 60 * 1000,  // 5 minutos
  newsCycleInterval: 14 * 1000,          // 14 segundos por notícia
  newsRefreshInterval: 20 * 60 * 1000,   // 20 minutos (TV atualiza manchetes de forma autônoma)
  streamingCycleInterval: 12 * 1000,     // 12 segundos por indicação de streaming
  wallpaperInterval: 90 * 1000,          // 90 segundos por wallpaper automático
  pixelShiftInterval: 5 * 60 * 1000,     // 5 minutos
  
  shiftMaxX: 14,
  shiftMaxY: 10,
};

// Coleção Completa com os 125 Wallpapers do Google Drive
const WALLPAPERS = (window.WALLPAPERS && window.WALLPAPERS.length > 0) ? window.WALLPAPERS : [
  "assets/wallpapers/wp-gargantua.jpg",
  "assets/wallpapers/spider-man-across-3840x2160-12108.jpg",
  "assets/wallpapers/torii-gate-cyberpunk-2077-by-sylvibot-3440x1440-v0-jtgvfrc7bxwd1.png",
  "assets/wallpapers/tanjiro-kamado-3840x2160-9322.jpg",
  "assets/wallpapers/dojo.jpg"
];

// Estado global de modais e ciclos
let isModalOpen = false;

// =========================================================
// 1. RELÓGIO & DATA EM TEMPO REAL
// =========================================================
function updateClock() {
  const now = new Date();
  
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const timeEl = document.getElementById("time-readout");
  if (timeEl) timeEl.textContent = `${hours}:${minutes}`;

  // Formatação em duas linhas: Dia da Semana + Dia e Mês
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });
  const dayMonth = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const dateFormatted = `${weekday}, ${dayMonth}`;

  // Level 2 Master Hero Card (Top-Left)
  const dateEl = document.getElementById("date-readout");
  const dateWeekdayEl = document.getElementById("date-weekday");
  const dateDayMonthEl = document.getElementById("date-daymonth");
  if (dateWeekdayEl && dateDayMonthEl) {
    dateWeekdayEl.textContent = weekday;
    dateDayMonthEl.textContent = dayMonth;
  } else if (dateEl) {
    dateEl.textContent = dateFormatted;
  }

  // Atualização do Relógio Adaptativo One UI (Nível 1)
  const adaptiveHoursEl = document.getElementById("adaptive-hours");
  const adaptiveMinutesEl = document.getElementById("adaptive-minutes");
  const adaptiveWeekdayEl = document.getElementById("adaptive-weekday");
  const adaptiveDayMonthEl = document.getElementById("adaptive-daymonth");
  const adaptiveDateEl = document.getElementById("adaptive-date");

  if (adaptiveHoursEl) adaptiveHoursEl.textContent = hours;
  if (adaptiveMinutesEl) adaptiveMinutesEl.textContent = minutes;
  if (adaptiveWeekdayEl) adaptiveWeekdayEl.textContent = weekday;
  if (adaptiveDayMonthEl) adaptiveDayMonthEl.textContent = dayMonth;
  if (adaptiveDateEl && !adaptiveWeekdayEl) adaptiveDateEl.textContent = dateFormatted;

  const tempBigEl = document.getElementById("current-temp");
  const weatherCondEl = document.getElementById("weather-cond");
  const adaptiveWeatherTempEl = document.getElementById("adaptive-weather-temp");
  const adaptiveWeatherCondEl = document.getElementById("adaptive-weather-cond");
  const adaptiveWeatherEl = document.getElementById("adaptive-weather");

  if (adaptiveWeatherTempEl && tempBigEl) {
    adaptiveWeatherTempEl.textContent = tempBigEl.textContent;
  }
  if (adaptiveWeatherCondEl && weatherCondEl) {
    adaptiveWeatherCondEl.textContent = weatherCondEl.textContent;
  }
  if (adaptiveWeatherEl && tempBigEl && weatherCondEl) {
    adaptiveWeatherEl.textContent = `${tempBigEl.textContent} ${weatherCondEl.textContent}`;
  }

  // Modo Noturno Automático (22h às 06h)
  if (now.getHours() >= 22 || now.getHours() < 6) {
    document.body.classList.add("night-mode");
  } else {
    document.body.classList.remove("night-mode");
  }
}

// =========================================================
// 2. FÓRMULA ASTRONÔMICA: FASE DA LUA OFFLINE
// =========================================================
function calculateMoonPhase(date = new Date()) {
  const epoch = new Date('2000-01-06T18:14:00Z').getTime();
  const synodicMonth = 29.53058867 * 86400000;
  const diff = (date.getTime() - epoch) % synodicMonth;
  const phaseNorm = (diff < 0 ? diff + synodicMonth : diff) / synodicMonth;
  
  const illum = Math.round((1 - Math.cos(phaseNorm * 2 * Math.PI)) / 2 * 100);
  
  let icon = "🌕";
  if (phaseNorm < 0.04 || phaseNorm > 0.96) icon = "🌑";
  else if (phaseNorm < 0.22) icon = "🌒";
  else if (phaseNorm < 0.28) icon = "🌓";
  else if (phaseNorm < 0.46) icon = "🌔";
  else if (phaseNorm < 0.54) icon = "🌕";
  else if (phaseNorm < 0.72) icon = "🌖";
  else if (phaseNorm < 0.78) icon = "🌗";
  else icon = "🌘";

  return { icon, illum };
}

// =========================================================
// 3. CLIMA REAL DE LONDRINA & ATMOSFERA (OPEN-METEO)
// =========================================================
const WMO_WEATHER_MAP = {
  0: "Céu Limpo",
  1: "Predom. Ensolarado",
  2: "Parcialmente Nublado",
  3: "Nublado",
  45: "Nevoeiro",
  51: "Garoa Leve",
  61: "Chuva Leve",
  63: "Chuva Moderada",
  65: "Chuva Forte",
  80: "Pancadas de Chuva",
  95: "Tempestade"
};

function getAqiDescription(aqi) {
  if (aqi <= 20) return { label: "Muito Bom" };
  if (aqi <= 40) return { label: "Bom" };
  if (aqi <= 60) return { label: "Moderado" };
  if (aqi <= 80) return { label: "Ruim" };
  return { label: "Muito Ruim" };
}

function getUvDescription(uv) {
  if (uv < 3) return { label: "Baixo" };
  if (uv < 6) return { label: "Moderado" };
  if (uv < 8) return { label: "Alto" };
  if (uv < 11) return { label: "Muito Alto" };
  return { label: "Extremo" };
}

async function fetchWeather() {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=America%2FSao_Paulo&forecast_days=1`;
    const resWeather = await fetch(weatherUrl);
    
    if (resWeather.ok) {
      const data = await resWeather.json();
      const current = data.current;
      const daily = data.daily;

      const temp = Math.round(current.temperature_2m);
      const feels = Math.round(current.apparent_temperature);
      const maxT = Math.round(daily.temperature_2m_max[0]);
      const minT = Math.round(daily.temperature_2m_min[0]);
      
      let condition = WMO_WEATHER_MAP[current.weather_code] || "Estável";
      const precip = current.precipitation || 0;
      if (precip > 0.1) {
        condition = `Chuva (${precip.toFixed(1)} mm)`;
      } else if (data.hourly && data.hourly.precipitation_probability) {
        const curHour = new Date().getHours();
        const rainProb = data.hourly.precipitation_probability[curHour] || 0;
        if (rainProb >= 30) {
          condition = `${condition} (${rainProb}% chuva)`;
        }
      }

      const uvMax = Math.round(daily.uv_index_max[0]);
      const uvDesc = getUvDescription(uvMax);

      let sunsetFormatted = "18:30";
      if (daily.sunset && daily.sunset[0]) {
        const sunsetDate = new Date(daily.sunset[0]);
        sunsetFormatted = `${String(sunsetDate.getHours()).padStart(2, "0")}:${String(sunsetDate.getMinutes()).padStart(2, "0")}`;
      }

      const tempEl = document.getElementById("current-temp");
      const condEl = document.getElementById("weather-cond");
      const feelsEl = document.getElementById("chip-feels");
      const rangeEl = document.getElementById("chip-range");
      const uvEl = document.getElementById("chip-uv");
      const sunsetEl = document.getElementById("chip-sunset");

      if (tempEl) tempEl.textContent = `${temp}°`;
      if (condEl) condEl.textContent = condition;
      if (feelsEl) feelsEl.textContent = `Sensação ${feels}°C`;
      if (rangeEl) rangeEl.textContent = `Máx ${maxT}° · Mín ${minT}°`;
      if (uvEl) uvEl.textContent = `☀️ UV ${uvMax} (${uvDesc.label})`;
      if (sunsetEl) sunsetEl.textContent = `🌅 Pôr ${sunsetFormatted}`;
    }

    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}&current=european_aqi,pm2_5&timezone=America%2FSao_Paulo`;
    const resAqi = await fetch(aqiUrl);
    if (resAqi.ok) {
      const aqiData = await resAqi.json();
      const aqiVal = Math.round(aqiData.current.european_aqi);
      const aqiDesc = getAqiDescription(aqiVal);
      const aqiEl = document.getElementById("chip-aqi");
      if (aqiEl) {
        aqiEl.textContent = `🍃 Ar ${aqiVal} (${aqiDesc.label})`;
      }
    }

    const moon = calculateMoonPhase();
    const moonEl = document.getElementById("chip-moon");
    if (moonEl) {
      moonEl.textContent = `${moon.icon} Lua ${moon.illum}%`;
    }

  } catch (err) {
    console.warn("Falha ao atualizar clima/atmosfera:", err);
  }
}

// =========================================================
// 3B. GEOLOCALIZAÇÃO PRECISA (BAIRRO & CIDADE)
// =========================================================
async function fetchPreciseLocation() {
  const geoEl = document.getElementById("geo-location");
  if (CONFIG.locationName) {
    if (geoEl) geoEl.textContent = CONFIG.locationName;
    return;
  }

  try {
    const cached = localStorage.getItem("ambient_precise_location");
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < 12 * 3600 * 1000 && data.label) {
        if (geoEl) geoEl.textContent = data.label;
        return;
      }
    }

    const ipRes = await fetch("http://ip-api.com/json/?fields=status,city,region,zip,lat,lon");
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData.status === "success") {
        let label = `${ipData.city || 'Londrina'}, ${ipData.region || 'PR'}`;
        const cepDigits = (ipData.zip || "86040").replace(/\D/g, "");
        
        try {
          const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepDigits.padEnd(8, '0')}/json/`);
          if (viaCepRes.ok) {
            const viaData = await viaCepRes.json();
            if (viaData.bairro && viaData.localidade) {
              label = `${viaData.bairro} · ${viaData.localidade}, ${viaData.uf || 'PR'}`;
            }
          }
        } catch (e) {
          label = "Jardim Califórnia · Londrina, PR";
        }

        if (geoEl) geoEl.textContent = label;
        try {
          localStorage.setItem("ambient_precise_location", JSON.stringify({
            label: label,
            timestamp: Date.now()
          }));
        } catch (e) {}
        return;
      }
    }
  } catch (err) {
    console.warn("Geolocalizacao em fallback:", err);
  }

  if (geoEl) geoEl.textContent = "Jardim Califórnia · Londrina, PR";
}

// =========================================================
// 4. MERCADO FINANCEIRO AO VIVO (3 ATIVOS ESTRITOS: USD, EUR, BTC)
// =========================================================
async function fetchMarketData() {
  try {
    const response = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL");
    if (!response.ok) return;

    const data = await response.json();

    if (data.USDBRL) {
      const bid = parseFloat(data.USDBRL.bid).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pct = parseFloat(data.USDBRL.pctChange);
      const rateEl = document.getElementById("usd-rate");
      const badge = document.getElementById("usd-badge");
      if (rateEl) rateEl.textContent = `R$ ${bid}`;
      if (badge) {
        badge.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        badge.className = `market-badge ${pct >= 0 ? "up" : "down"}`;
      }
    }

    if (data.EURBRL) {
      const bid = parseFloat(data.EURBRL.bid).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pct = parseFloat(data.EURBRL.pctChange);
      const rateEl = document.getElementById("eur-rate");
      const badge = document.getElementById("eur-badge");
      if (rateEl) rateEl.textContent = `R$ ${bid}`;
      if (badge) {
        badge.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        badge.className = `market-badge ${pct >= 0 ? "up" : "down"}`;
      }
    }

    if (data.BTCBRL) {
      const bid = Math.round(parseFloat(data.BTCBRL.bid)).toLocaleString("pt-BR");
      const pct = parseFloat(data.BTCBRL.pctChange);
      const rateEl = document.getElementById("btc-rate");
      const badge = document.getElementById("btc-badge");
      if (rateEl) rateEl.textContent = `R$ ${bid}`;
      if (badge) {
        badge.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        badge.className = `market-badge ${pct >= 0 ? "up" : "down"}`;
      }
    }
  } catch (err) {
    console.warn("Falha ao atualizar cotações de mercado:", err);
  }
}

// =========================================================
// 5. STREAMING PERSONALIZADO: FICHA TÉCNICA & TRAILER
// Perfil Curado: Sci-Fi, Distopias, Cyberpunk, Animações Adultas, Nolan
// Assinaturas: Netflix, Apple TV+, Max, Disney+, Prime Video, Mercado Play
// =========================================================
const STREAMING_ITEMS = [
  {
    service: "NETFLIX",
    class: "netflix",
    title: "O Problema dos 3 Corpos",
    genre: "Ficção Científica · Mistério · Suspense Cósmico",
    year: "2024",
    duration: "1 Temporada · 8 Episódios",
    rating: "★ 8.5",
    age: "16+",
    synopsis: "Uma decisão fatal tomada na China durante a Revolução Cultural repercute através do tempo e do espaço. Quando cientistas de ponta do mundo inteiro começam a morrer misteriosamente, um grupo de físicos brilhantes se une para enfrentar a maior ameaça extraterrestre da história humana.",
    cast: "Benedict Wong, Jess Hong, Jovan Adepo, Eiza González, Liam Cunningham",
    creators: "David Benioff, D.B. Weiss (Game of Thrones), Alexander Woo",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/507/1268925.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/mydFes62924",
    deepLink: "https://www.netflix.com/title/81024039"
  },
  {
    service: "APPLE TV+",
    class: "appletv",
    title: "Ruptura (Severance)",
    genre: "Ficção Científica · Suspense Psicológico · Distopia",
    year: "2022-2025",
    duration: "2 Temporadas · 19 Episódios",
    rating: "★ 8.7",
    age: "16+",
    synopsis: "Mark Scout lidera uma equipe na Lumon Industries cujos empregados passaram pelo procedimento de 'ruptura', que separa cirurgicamente suas memórias entre vida profissional e pessoal. Esse experimento radical é questionado quando um misterioso ex-colega aparece fora do trabalho.",
    cast: "Adam Scott, Patricia Arquette, John Turturro, Christopher Walken, Britt Lower",
    creators: "Dan Erickson · Dirigido por Ben Stiller",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/548/1371406.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/xEQP4VVuyrY",
    deepLink: "https://tv.apple.com/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx"
  },
  {
    service: "NETFLIX",
    class: "netflix",
    title: "Cyberpunk: Edgerunners",
    genre: "Anime · Cyberpunk · Ação Futurista · Sci-Fi",
    year: "2022",
    duration: "1 Temporada · 10 Episódios",
    rating: "★ 8.3",
    age: "18+",
    synopsis: "Em uma Night City distópica e implacável, obcecada por tecnologia e modificação corporal, um garoto de rua impulsivo perde tudo o que ama. Para sobreviver, ele escolhe o caminho mais perigoso: tornar-se um Edgerunner, um mercenário fora-da-lei cibernético.",
    cast: "Aoi Yuuki, KENN, Hiroki Touchi, Michiko Kaiden",
    creators: "Studio Trigger (Hiroyuki Imaishi) & CD PROJEKT RED",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/424/1061909.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/JtqIas3bYhg",
    deepLink: "https://www.netflix.com/title/81054853"
  },
  {
    service: "MAX",
    class: "max",
    title: "Duna: A Profecia",
    genre: "Ficção Científica · Épico Cósmico · Drama Político",
    year: "2024",
    duration: "1 Temporada · 6 Episódios",
    rating: "★ 8.4",
    age: "16+",
    synopsis: "Dez mil anos antes do nascimento de Paul Atreides, a trama segue duas irmãs da Casa Harkonnen enquanto combatem forças que ameaçam o futuro da humanidade e estabelecem a lendária ordem secreta que viria a ser conhecida como Bene Gesserit.",
    cast: "Emily Watson, Olivia Williams, Jodhi May, Sarah-Sofie Boussnina, Travis Fimmel",
    creators: "Diane Ademu-John, Alison Schapker · Universo de Frank Herbert",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/543/1358056.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/O4iQGzDq0x0",
    deepLink: "https://play.max.com"
  },
  {
    service: "PRIME VIDEO",
    class: "prime",
    title: "Fallout",
    genre: "Pós-Apocalíptico · Ficção Científica · Humor Ácido",
    year: "2024",
    duration: "1 Temporada · 8 Episódios",
    rating: "★ 8.4",
    age: "18+",
    synopsis: "200 anos após o holocausto atômico, Lucy deixa o conforto protegido de seu Refúgio subterrâneo para resgatar o pai. Ela é jogada de cabeça nas terras devastadas de Los Angeles, um inferno bizarro e violento habitado por necrófagos, mutantes e a Irmandade de Aço.",
    cast: "Ella Purnell, Walton Goggins, Aaron Moten, Kyle MacLachlan",
    creators: "Jonathan Nolan, Lisa Joy (Westworld) · Baseado no jogo da Bethesda",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/599/1499142.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/V-mugKDQDlg",
    deepLink: "https://www.primevideo.com/detail/Fallout"
  },
  {
    service: "DISNEY+",
    class: "disney",
    title: "X-Men '97",
    genre: "Animação Clássica · Super-Heróis · Drama Mutante",
    year: "2024",
    duration: "1 Temporada · 10 Episódios",
    rating: "★ 8.9",
    age: "14+",
    synopsis: "Sequência direta da clássica animação dos anos 90. Após o desaparecimento do Professor Charles Xavier, os X-Men enfrentam um mundo hostil sob a liderança improvável de Magneto, confrontando tragédias devastadoras e o surgimento de Sentinelas mais letais.",
    cast: "Ray Chase, Cal Dodd, Lenore Zann, George Buza, Alison Sealy-Smith",
    creators: "Marvel Animation · Criado por Beau DeMayo",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/630/1576859.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/pv3Ss8o99qE",
    deepLink: "https://www.disneyplus.com"
  },
  {
    service: "MERCADO PLAY",
    class: "mercadoplay",
    title: "Oppenheimer",
    genre: "Biografia · Drama Histórico · Cinema Nolan",
    year: "2023",
    duration: "3h 00m · Vencedor de 7 Oscars",
    rating: "★ 8.9",
    age: "16+",
    synopsis: "O físico teórico J. Robert Oppenheimer lidera o ultra-secreto Projeto Manhattan no deserto de Los Alamos, criando a arma que encerrou a Segunda Guerra Mundial e mudou a história do planeta para sempre, enquanto lida com as consequências éticas e políticas de sua invenção.",
    cast: "Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr., Florence Pugh",
    creators: "Escrito e Dirigido por Christopher Nolan",
    poster: "https://upload.wikimedia.org/wikipedia/pt/5/5b/Oppenheimer_poster.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/F3J2pyr-mQg",
    deepLink: "https://play.mercadolivre.com.br"
  },
  {
    service: "APPLE TV+",
    class: "appletv",
    title: "Silo",
    genre: "Ficção Científica · Distopia · Mistério Subterrâneo",
    year: "2023-2024",
    duration: "2 Temporadas · 20 Episódios",
    rating: "★ 8.1",
    age: "16+",
    synopsis: "Em um futuro em que a superfície da Terra se tornou letal, os últimos dez mil humanos vivem confinados em um gigantesco silo de 144 andares no subsolo. Ninguém sabe quem o construiu nem por quê. Quando mortes misteriosas acontecem, a engenheira Juliette decide ir a fundo na verdade.",
    cast: "Rebecca Ferguson, Common, Tim Robbins, Harriet Walter, Rashida Jones",
    creators: "Graham Yost · Baseado nos livros de Hugh Howey",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/631/1577677.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/8ZYhuvIv1pA",
    deepLink: "https://tv.apple.com"
  },
  {
    service: "MAX",
    class: "max",
    title: "Pinguim (The Penguin)",
    genre: "Crime Organizado · Drama Gotham · Thriller Noir",
    year: "2024",
    duration: "1 Temporada · 8 Episódios",
    rating: "★ 8.8",
    age: "18+",
    synopsis: "Continuando os acontecimentos do filme The Batman de Matt Reeves, Oswald 'Oz' Cobb aproveita o vácuo de poder deixado pela morte de Carmine Falcone para iniciar uma ascensão brutal e calculista pelo trono do crime nos becos inundados de Gotham City.",
    cast: "Colin Farrell, Cristin Milioti, Rhenzy Feliz, Clancy Brown",
    creators: "Lauren LeFranc · Produção Executiva de Matt Reeves",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/536/1340329.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/sfJG6hvoebM",
    deepLink: "https://play.max.com"
  },
  {
    service: "PRIME VIDEO",
    class: "prime",
    title: "The Boys",
    genre: "Sátira · Ação Sangrenta · Ficção Científica",
    year: "2019-2024",
    duration: "4 Temporadas · 32 Episódios",
    rating: "★ 8.7",
    age: "18+",
    synopsis: "E se os super-heróis fossem corporativos, narcisistas e corruptos? Um esquadrão clandestino de humanos comuns armados até os dentes e liderados pelo vingativo Billy Bruto decide expor a verdade sobre a Vought e derrubar o todo-poderoso Capitão Pátria.",
    cast: "Karl Urban, Antony Starr, Jack Quaid, Erin Moriarty, Jensen Ackles",
    creators: "Eric Kripke · Baseado nos quadrinhos de Garth Ennis",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/619/1547768.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/06rueu_fh30",
    deepLink: "https://www.primevideo.com"
  },
  {
    service: "DISNEY+",
    class: "disney",
    title: "Shōgun",
    genre: "Drama Histórico · Guerra Feudal · Japão Medieval",
    year: "2024",
    duration: "1 Temporada · 18 Prêmios Emmy",
    rating: "★ 8.7",
    age: "16+",
    synopsis: "No Japão de 1600, prestes a mergulhar em uma guerra civil épica, Lord Yoshii Toranaga é encurralado por seus rivais no Conselho de Regentes. A chegada misteriosa de um piloto marítimo inglês, John Blackthorne, oferece a Toranaga os segredos de pólvora necessários para desafiar o destino.",
    cast: "Hiroyuki Sanada, Cosmo Jarvis, Anna Sawai, Tadanobu Asano",
    creators: "Rachel Kondo, Justin Marks · Baseado na obra de James Clavell",
    poster: "https://static.tvmaze.com/uploads/images/medium_portrait/506/1265637.jpg",
    trailer: "https://www.youtube-nocookie.com/embed/yFNhkmsqKug",
    deepLink: "https://www.disneyplus.com"
  },
  {
    service: "MERCADO PLAY",
    class: "mercadoplay",
    title: "Whiplash: Em Busca da Perfeição",
    genre: "Drama · Música · Obsessão · 3 Oscars",
    year: "2014",
    duration: "1h 47m · Obra-Prima",
    rating: "★ 8.5",
    age: "14+",
    synopsis: "Andrew Neiman é um jovem e ambicioso baterista que ingressa no conservatório de elite Shaffer em Nova York. Seu talento atrai Terence Fletcher, um instrutor cuja metodologia ultrapassa os limites da tortura psicológica para extrair o potencial máximo de seus alunos.",
    cast: "Miles Teller, J.K. Simmons, Paul Reiser, Melissa Benoist",
    creators: "Escrito e Dirigido por Damien Chazelle (La La Land)",
    poster: "https://upload.wikimedia.org/wikipedia/pt/c/cd/Whiplash_em_busca_da_perfeicao.png",
    trailer: "https://www.youtube-nocookie.com/embed/7d_jQycdQGo",
    deepLink: "https://play.mercadolivre.com.br"
  }
];

let streamIndex = 0;
let modalStreamIndex = 0;
let streamProgressStart = Date.now();

function renderStreamingItem() {
  const badgeEl = document.getElementById("stream-service-badge");
  const ratingEl = document.getElementById("stream-rating");
  const titleEl = document.getElementById("stream-title");
  const genreEl = document.getElementById("stream-genre");
  const posterImg = document.getElementById("stream-poster");
  const skeletonEl = document.getElementById("stream-poster-skeleton");

  if (!badgeEl || !ratingEl || !titleEl || !genreEl) return;

  const item = STREAMING_ITEMS[streamIndex % STREAMING_ITEMS.length];
  badgeEl.textContent = item.service;
  badgeEl.className = `streaming-tag ${item.class}`;
  ratingEl.textContent = item.rating;
  titleEl.textContent = item.title;
  genreEl.textContent = item.genre;

  if (posterImg && item.poster) {
    // Sincronização estrita: define imediatamente o src do novo item
    posterImg.classList.remove("loaded");
    if (skeletonEl) skeletonEl.classList.remove("hidden");

    posterImg.onload = () => {
      posterImg.classList.add("loaded");
      if (skeletonEl) skeletonEl.classList.add("hidden");
    };
    posterImg.onerror = () => {
      if (skeletonEl) skeletonEl.classList.add("hidden");
    };
    posterImg.src = item.poster;
  }
}

function cycleStreaming() {
  if (isModalOpen) return;

  const titleEl = document.getElementById("stream-title");
  const posterImg = document.getElementById("stream-poster");

  if (titleEl) {
    titleEl.style.opacity = "0";
    titleEl.style.transform = "translateY(-3px)";
  }
  if (posterImg) {
    posterImg.classList.remove("loaded");
  }

  setTimeout(() => {
    streamIndex = (streamIndex + 1) % STREAMING_ITEMS.length;
    renderStreamingItem();
    if (titleEl) {
      titleEl.style.opacity = "1";
      titleEl.style.transform = "translateY(0)";
    }
    streamProgressStart = Date.now();
  }, 300);
}

function updateStreamingProgressBar() {
  if (!isModalOpen) {
    const bar = document.getElementById("stream-progress-bar");
    if (bar) {
      const elapsed = Date.now() - streamProgressStart;
      const pct = Math.min((elapsed / CONFIG.streamingCycleInterval) * 100, 100);
      bar.style.width = `${pct}%`;

      if (elapsed >= CONFIG.streamingCycleInterval) {
        cycleStreaming();
      }
    }
  }

  requestAnimationFrame(updateStreamingProgressBar);
}

// =========================================================
// 6. MODAL EXPANDIDO DE STREAMING: FICHA & TRAILER
// =========================================================
function launchStreamingService(url) {
  if (!url) return;
  console.log("[Streaming] Abrindo na plataforma:", url);

  // 1. Tenta acionar via Tizen ApplicationControl nativo (se disponível)
  if (window.tizen && tizen.application) {
    try {
      const appControl = new tizen.ApplicationControl(
        "http://tizen.org/appcontrol/operation/view",
        url
      );
      tizen.application.launchAppControl(appControl, null,
        () => console.log("[Streaming] Tizen AppControl lançado com sucesso para:", url),
        (err) => {
          console.warn("[Streaming] Falha no AppControl, navegando via window.open:", err);
          window.open(url, "_blank");
        }
      );
      return;
    } catch (e) {
      console.warn("[Streaming] Exceção ao executar tizen.application.launchAppControl:", e);
    }
  }

  // 2. Fallback padrão Web
  window.open(url, "_blank");
}

function openStreamingModal(index = streamIndex) {
  modalStreamIndex = index % STREAMING_ITEMS.length;
  isModalOpen = true;

  updateStreamingModalContent();

  const modal = document.getElementById("streaming-modal");
  if (modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }

  // Foco imediato no botão de ação principal (Abrir na Plataforma)
  setTimeout(() => {
    const openBtn = document.getElementById("btn-open-service");
    if (openBtn) openBtn.focus();
  }, 80);
}

function updateStreamingModalContent() {
  const item = STREAMING_ITEMS[modalStreamIndex % STREAMING_ITEMS.length];
  if (!item) return;

  const tagEl = document.getElementById("modal-stream-tag");
  const yearEl = document.getElementById("modal-stream-year");
  const durEl = document.getElementById("modal-stream-duration");
  const ageEl = document.getElementById("modal-stream-age");
  const rateEl = document.getElementById("modal-stream-rating");
  const titleEl = document.getElementById("modal-stream-title");
  const genreEl = document.getElementById("modal-stream-genre");
  const posterEl = document.getElementById("modal-stream-poster");
  const synEl = document.getElementById("modal-stream-synopsis");
  const castEl = document.getElementById("modal-stream-cast");
  const creatEl = document.getElementById("modal-stream-creators");
  const counterEl = document.getElementById("modal-nav-counter");
  const openLink = document.getElementById("btn-open-service");
  const openLabel = document.getElementById("btn-open-service-label");

  if (tagEl) {
    tagEl.textContent = item.service;
    tagEl.className = `streaming-tag ${item.class}`;
  }
  if (yearEl) yearEl.textContent = item.year;
  if (durEl) durEl.textContent = item.duration;
  if (ageEl) ageEl.textContent = item.age;
  if (rateEl) rateEl.textContent = item.rating;
  if (titleEl) titleEl.textContent = item.title;
  if (genreEl) genreEl.textContent = item.genre;
  if (posterEl) posterEl.src = item.poster;
  if (synEl) synEl.textContent = item.synopsis;
  if (castEl) castEl.textContent = item.cast;
  if (creatEl) creatEl.textContent = item.creators;
  if (counterEl) counterEl.textContent = `${(modalStreamIndex % STREAMING_ITEMS.length) + 1} / ${STREAMING_ITEMS.length}`;

  if (openLink) {
    openLink.href = item.deepLink;
  }
  if (openLabel) {
    openLabel.textContent = `Abrir no ${item.service}`;
  }
}

function closeStreamingModal() {
  const modal = document.getElementById("streaming-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
  isModalOpen = false;
  streamProgressStart = Date.now();

  // Devolve o foco para o card na tela principal
  const card = document.getElementById("streaming-card");
  if (card) card.focus();
}

// =========================================================
// 7. NOTÍCIAS AO VIVO (GOOGLE NEWS BRASIL & G1) COM AUTO-REFRESH (20 MIN)
// =========================================================
const NEWS_FEEDS = {
  "google-top": {
    name: "Google News Brasil (Destaques)",
    url: "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    defaultPrefix: "GOOGLE NEWS"
  },
  "google-tech": {
    name: "Google News Tecnologia",
    url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    defaultPrefix: "GOOGLE NEWS · TECH"
  },
  "google-business": {
    name: "Google News Economia",
    url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=pt-BR&gl=BR&ceid=BR:pt-419",
    defaultPrefix: "GOOGLE NEWS · ECONOMIA"
  },
  "g1-tech": {
    name: "G1 Tecnologia",
    url: "https://g1.globo.com/rss/g1/tecnologia/",
    defaultPrefix: "G1 TECNOLOGIA"
  }
};

let currentNewsFeed = localStorage.getItem("ambient_news_feed") || (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.newsFeed) || "google-top";
let lastNewsFetchTime = 0;

let newsArticles = [
  {
    source: "GOOGLE NEWS · BRASIL",
    title: "Conectando ao feed de notícias em tempo real...",
    lead: "As principais manchetes do Brasil e do mundo são atualizadas de forma autônoma a cada 20 minutos pela sua TV.",
    link: "https://news.google.com/",
    image: null
  }
];

const NEWS_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
];

let newsIndex = 0;
let modalNewsIndex = 0;
let newsProgressStart = Date.now();

function updateNewsTimestampIndicator() {
  const lastUpdatedEl = document.getElementById("news-last-updated");
  if (lastUpdatedEl) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    lastUpdatedEl.textContent = `Atualizado às ${timeStr} · auto a cada 20 min`;
  }
}

async function fetchLiveNews(forceFeedKey = null) {
  const feedKey = forceFeedKey || currentNewsFeed || "google-top";
  const feedConfig = NEWS_FEEDS[feedKey] || NEWS_FEEDS["google-top"];

  try {
    const rssUrl = encodeURIComponent(feedConfig.url);
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      newsArticles = data.items.map((item) => {
        let title = (item.title || "")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();
        let source = feedConfig.defaultPrefix;

        // Se for Google News, o título frequentemente termina em " - NomeDoVeiculo"
        const lastDash = title.lastIndexOf(" - ");
        if (lastDash > 5) {
          const outlet = title.substring(lastDash + 3).trim();
          title = title.substring(0, lastDash).trim();
          source = `GOOGLE NEWS · ${outlet.toUpperCase()}`;
        } else if (feedKey === "g1-tech") {
          source = "G1 TECNOLOGIA";
        }

        let imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link);
        if (!imageUrl && item.content) {
          const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match) imageUrl = match[1];
        }

        let leadText = "";
        const rawDesc = item.description || "";
        // Se for lista de manchetes agregadas do Google News (<ol><li>...):
        if (rawDesc.includes("<ol>") || rawDesc.includes("<li>")) {
          const cleanMatches = [...rawDesc.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>(?:&nbsp;|\s)*(?:<font[^>]*>(.*?)<\/font>)?/gi)];
          if (cleanMatches.length > 1) {
            const related = cleanMatches.slice(1, 4).map(m => {
              const t = m[2].replace(/<[^>]+>/g, "").trim();
              const src = (m[3] || "").replace(/<[^>]+>/g, "").trim();
              return src ? `• ${t} (${src})` : `• ${t}`;
            }).join("\n");
            const outletClean = source.replace("GOOGLE NEWS · ", "").trim();
            leadText = `Confira a cobertura em tempo real apurada por ${outletClean}.\n\nPrincipais desdobramentos:\n${related}`;
          } else {
            const outletClean = source.replace("GOOGLE NEWS · ", "").trim();
            leadText = `Confira a cobertura completa e atualizações desta matéria apurada por ${outletClean}. Toque no botão abaixo para ler o artigo original na íntegra.`;
          }
        } else {
          leadText = rawDesc
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }

        if (!leadText || leadText.length < 20) {
          const outletClean = source.replace("GOOGLE NEWS · ", "").trim();
          leadText = `Confira a cobertura completa desta matéria publicada por ${outletClean}. Toque no botão abaixo para ler o artigo original na íntegra.`;
        }

        return {
          source: source,
          title: title,
          lead: leadText,
          link: item.link || feedConfig.url,
          image: imageUrl || null
        };
      });

      lastNewsFetchTime = Date.now();
      try {
        localStorage.setItem("ambient_cached_news_" + feedKey, JSON.stringify(newsArticles));
      } catch (e) {}

      updateNewsTimestampIndicator();
      renderCurrentNews();
    }
  } catch (err) {
    console.warn("[News] Falha ao puxar RSS ao vivo, tentando carregar cache local:", err);
    try {
      const cached = localStorage.getItem("ambient_cached_news_" + feedKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          newsArticles = parsed;
          renderCurrentNews();
        }
      }
    } catch (e) {}
  }
}

function setNewsFeed(feedKey) {
  if (!NEWS_FEEDS[feedKey]) return;
  currentNewsFeed = feedKey;
  localStorage.setItem("ambient_news_feed", feedKey);
  updateNewsFeedPillsUI();
  fetchLiveNews(feedKey);
  syncConfigToLocalProject();
}

function updateNewsFeedPillsUI() {
  const pills = document.querySelectorAll("#news-feed-group .settings-pill-btn");
  pills.forEach((pill) => {
    const feed = pill.getAttribute("data-feed");
    if (feed === currentNewsFeed) {
      pill.classList.add("active");
      pill.setAttribute("aria-checked", "true");
    } else {
      pill.classList.remove("active");
      pill.setAttribute("aria-checked", "false");
    }
  });
}

function renderCurrentNews() {
  const headlineEl = document.getElementById("news-headline");
  const sourceEl = document.getElementById("news-source");
  const thumbImg = document.getElementById("news-thumb");
  const skeletonEl = document.getElementById("news-thumb-skeleton");

  if (!headlineEl || !sourceEl || newsArticles.length === 0) return;

  const current = newsArticles[newsIndex % newsArticles.length];
  sourceEl.textContent = current.source;
  headlineEl.textContent = current.title;

  const fallbackImg = NEWS_FALLBACK_IMAGES[newsIndex % NEWS_FALLBACK_IMAGES.length];
  const targetImgSrc = current.image || fallbackImg;

  if (thumbImg) {
    if (skeletonEl) skeletonEl.classList.remove("hidden");
    thumbImg.classList.remove("loaded");

    thumbImg.onload = () => {
      thumbImg.classList.add("loaded");
      if (skeletonEl) skeletonEl.classList.add("hidden");
    };
    thumbImg.onerror = () => {
      if (thumbImg.src !== fallbackImg) {
        thumbImg.src = fallbackImg;
      } else if (skeletonEl) {
        skeletonEl.classList.add("hidden");
      }
    };
    thumbImg.src = targetImgSrc;
  }
}

function cycleNews() {
  if (isModalOpen) return;

  const headlineEl = document.getElementById("news-headline");
  const thumbImg = document.getElementById("news-thumb");

  if (headlineEl) {
    headlineEl.classList.remove("fade-in");
    headlineEl.classList.add("fade-out");
  }
  if (thumbImg) {
    thumbImg.classList.remove("loaded");
  }

  setTimeout(() => {
    newsIndex = (newsIndex + 1) % newsArticles.length;
    renderCurrentNews();
    if (headlineEl) {
      headlineEl.classList.remove("fade-out");
      headlineEl.classList.add("fade-in");
    }
    newsProgressStart = Date.now();
  }, 400);
}

function updateNewsProgressBar() {
  if (!isModalOpen) {
    const bar = document.getElementById("news-progress-bar");
    if (bar) {
      const elapsed = Date.now() - newsProgressStart;
      const pct = Math.min((elapsed / CONFIG.newsCycleInterval) * 100, 100);
      bar.style.width = `${pct}%`;

      if (elapsed >= CONFIG.newsCycleInterval) {
        cycleNews();
      }
    }
  }

  requestAnimationFrame(updateNewsProgressBar);
}

function formatNewsLead(leadText) {
  if (!leadText) return "";
  const clean = leadText.replace(/\r\n/g, "\n").trim();
  const rawParagraphs = clean.split(/\n+/).filter(p => p.trim().length > 0);
  if (rawParagraphs.length > 1) {
    return rawParagraphs.map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith("• ")) {
        return `<p class="news-para" style="margin-left: 12px; margin-bottom: 8px; color: var(--cyan); font-weight: 500;">${trimmed}</p>`;
      }
      return `<p class="news-para">${trimmed}</p>`;
    }).join("");
  }
  const sentences = clean.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (!sentences || sentences.length <= 2) {
    return `<p class="news-para">${clean}</p>`;
  }
  const paras = [];
  let currentGroup = "";
  for (let i = 0; i < sentences.length; i++) {
    currentGroup += (currentGroup ? " " : "") + sentences[i].trim();
    if (currentGroup.length >= 220 || i === sentences.length - 1) {
      paras.push(`<p class="news-para">${currentGroup}</p>`);
      currentGroup = "";
    }
  }
  if (currentGroup) paras.push(`<p class="news-para">${currentGroup}</p>`);
  return paras.join("");
}

function updateNewsModalContent() {
  if (!newsArticles || newsArticles.length === 0) return;
  const current = newsArticles[modalNewsIndex % newsArticles.length];
  if (!current) return;

  const imgEl = document.getElementById("modal-news-img");
  const sourceEl = document.getElementById("modal-news-source");
  const headlineEl = document.getElementById("modal-news-headline");
  const textEl = document.getElementById("modal-news-text");
  const linkEl = document.getElementById("modal-news-link");
  const counterEl = document.getElementById("modal-news-nav-counter");

  if (imgEl) {
    const fallbackImg = NEWS_FALLBACK_IMAGES[modalNewsIndex % NEWS_FALLBACK_IMAGES.length];
    imgEl.src = current.image || fallbackImg;
  }
  if (sourceEl) sourceEl.textContent = current.source;
  if (headlineEl) headlineEl.textContent = current.title;
  if (textEl) textEl.innerHTML = formatNewsLead(current.lead);
  if (linkEl) {
    linkEl.href = current.link;
    const linkSpan = linkEl.querySelector("span");
    if (linkSpan) {
      linkSpan.textContent = current.source.includes("G1") ? "Ler Matéria Completa no G1" : "Abrir Matéria Completa";
    }
  }
  if (counterEl) {
    counterEl.textContent = `${(modalNewsIndex % newsArticles.length) + 1} / ${newsArticles.length}`;
  }

  const modalCard = document.getElementById("news-modal-card");
  if (modalCard) modalCard.scrollTop = 0;
}

// Modal de Leitura de Notícia G1 / Google News
function openNewsModal(index = newsIndex) {
  if (!newsArticles || newsArticles.length === 0) return;
  modalNewsIndex = index % newsArticles.length;
  isModalOpen = true;

  updateNewsModalContent();

  const modal = document.getElementById("news-modal");
  const modalCard = document.getElementById("news-modal-card");
  if (modalCard) modalCard.scrollTop = 0;

  if (modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }

  // Foco imediato no botão de leitura completa ou fechar
  setTimeout(() => {
    if (modalCard) modalCard.scrollTop = 0;
    const linkEl = document.getElementById("modal-news-link");
    const closeBtn = document.getElementById("modal-close-news");
    if (linkEl) linkEl.focus();
    else if (closeBtn) closeBtn.focus();
    if (modalCard) modalCard.scrollTop = 0;
  }, 60);
}

function closeNewsModal() {
  const modal = document.getElementById("news-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
  isModalOpen = false;
  newsProgressStart = Date.now();

  // Sincroniza o índice de notícias exibido no painel principal
  if (newsArticles.length > 0) {
    newsIndex = modalNewsIndex % newsArticles.length;
    renderCurrentNews();
  }

  // Devolve o foco para o card de notícias
  const card = document.getElementById("news-card");
  if (card) card.focus();
}

// =========================================================
// 8. SISTEMA DE 3 NÍVEIS DE EXIBIÇÃO & RELÓGIO ADAPTATIVO
// 2: Completo (Padrão) | 1: Relógio Adaptativo | 0: Zen Puro
// =========================================================
let currentDisplayLevel = parseInt(localStorage.getItem("ambient_display_level") || "2", 10);
try {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("level")) {
    currentDisplayLevel = parseInt(urlParams.get("level"), 10);
  }
} catch (e) {}

let currentClockPosition = "pos-top-right";
let hudTimer = null;

function updateHudDockPosition(clockPos = currentClockPosition) {
  if (clockPos) currentClockPosition = clockPos;
  const dock = document.getElementById("ambient-hud-dock");
  if (!dock) return;

  const isClockOnRight = currentClockPosition && (
    currentClockPosition.includes("right") || 
    currentClockPosition === "pos-top-right" || 
    currentClockPosition === "pos-center-right" || 
    currentClockPosition === "pos-bottom-right"
  );

  // No Nível 1 (Relógio Adaptativo), se o relógio estiver na direita, move o dock para a esquerda
  // para garantir zero sobreposição e equilíbrio Gestalt de peso visual.
  if (currentDisplayLevel === 1 && isClockOnRight) {
    dock.classList.add("dock-left");
    dock.classList.remove("dock-right");
  } else {
    // No Nível 2 (Dashboard Completo) e demais posições, dock fica no topo-direito.
    dock.classList.add("dock-right");
    dock.classList.remove("dock-left");
  }
}

function resetControlsHudTimer() {
  const dock = document.getElementById("ambient-hud-dock");
  if (!dock) return;
  dock.classList.remove("hud-faded");
  clearTimeout(hudTimer);

  hudTimer = setTimeout(() => {
    const zenBtn = document.getElementById("zen-mode-btn");
    const settingsOpenBtn = document.getElementById("settings-open-btn");
    const switcherBtn = document.getElementById("wallpaper-switcher-btn");
    const active = document.activeElement;
    if (active === zenBtn || active === settingsOpenBtn || active === switcherBtn) {
      return;
    }
    // No Nível 1 (Relógio Adaptativo) e Nível 0 (Zen Puro), esconde após 4.5s para tela limpa
    if (currentDisplayLevel === 1 || currentDisplayLevel === 0) {
      dock.classList.add("hud-faded");
    }
  }, 4500);
}

function setDisplayLevel(level, animate = true) {
  currentDisplayLevel = level;
  try {
    localStorage.setItem("ambient_display_level", level);
  } catch (e) {
    // LocalStorage fallback seguro
  }

  document.body.classList.remove("display-level-0", "display-level-1", "display-level-2");
  document.body.classList.add(`display-level-${level}`);

  updateHudDockPosition();
  resetControlsHudTimer();

  const zenIcon = document.getElementById("zen-mode-icon");
  const zenLabel = document.getElementById("zen-mode-label");
  const zenBtn = document.getElementById("zen-mode-btn");

  if (zenBtn) {
    if (level === 0) {
      zenBtn.classList.add("zen-mode-ghost");
      zenBtn.setAttribute("title", "Modo Zen Ativo: Pressione qualquer tecla ou clique para reativar");
    } else {
      zenBtn.classList.remove("zen-mode-ghost");
      zenBtn.setAttribute("title", level === 2 ? "Modo Completo (Clique para alternar)" : "Modo Relógio Adaptativo (Clique para alternar)");
    }
  }

  if (zenIcon) {
    if (level === 2) {
      zenIcon.setAttribute("data-lucide", "eye");
      if (zenLabel) zenLabel.textContent = "PAINEL";
    } else if (level === 1) {
      zenIcon.setAttribute("data-lucide", "sparkles");
      if (zenLabel) zenLabel.textContent = "ADAPTATIVO";
    } else {
      zenIcon.setAttribute("data-lucide", "eye-off");
      if (zenLabel) zenLabel.textContent = "ZEN";
    }
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // Animações Suaves com Anime.js
  if (window.anime && animate) {
    if (level === 1) {
      anime({
        targets: '#adaptive-clock',
        scale: [0.94, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutCubic'
      });
    } else if (level === 2) {
      anime({
        targets: ['.quad-top-left', '.quad-bottom-left', '.bottom-right-cluster'],
        translateY: [16, 0],
        opacity: [0, 1],
        duration: 420,
        delay: anime.stagger(50),
        easing: 'easeOutCubic'
      });
    }
  }
}

function cycleDisplayLevel() {
  const nextLevel = currentDisplayLevel === 2 ? 1 : (currentDisplayLevel === 1 ? 0 : 2);
  setDisplayLevel(nextLevel, true);
}

// =========================================================
// 8B. MOTOR INTELIGENTE DE ANÁLISE DE WALLPAPER (ONE UI / APPLE)
// =========================================================
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function analyzeWallpaperAndAdapt(imageSrc) {
  const adaptiveClock = document.getElementById("adaptive-clock");
  if (!adaptiveClock) return;

  // 1. Configuração artesanal sob medida (tamanho monumental, posição que não cobre o personagem e cor harmônica)
  if (window.WALLPAPER_CONFIGS && window.WALLPAPER_CONFIGS[imageSrc]) {
    const cfg = window.WALLPAPER_CONFIGS[imageSrc];
    adaptiveClock.className = `adaptive-clock ${cfg.layout} ${cfg.position}`;
    updateHudDockPosition(cfg.position);

    document.documentElement.style.setProperty("--clock-adaptive-color", cfg.color);
    document.documentElement.style.setProperty("--clock-adaptive-shadow", cfg.shadow);
    document.documentElement.style.setProperty("--clock-font-size", cfg.fontSize);
    document.documentElement.style.setProperty("--clock-meta-size", cfg.metaSize);

    const font = cfg.fontFamily || "var(--font-display)";
    document.documentElement.style.setProperty("--clock-font-family", font);
    if (font.includes("Cinzel")) {
      document.documentElement.style.setProperty("--clock-letter-spacing", "2px");
    } else if (font.includes("Orbitron")) {
      document.documentElement.style.setProperty("--clock-letter-spacing", "-2px");
    } else if (font.includes("Cormorant")) {
      document.documentElement.style.setProperty("--clock-letter-spacing", "0px");
    } else if (font.includes("Bebas")) {
      document.documentElement.style.setProperty("--clock-letter-spacing", "-4px");
    } else {
      document.documentElement.style.setProperty("--clock-letter-spacing", "-10px");
    }
    return;
  }

  // 2. Fallback inteligente via canvas para novas imagens
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 64, 36);
      const imgData = ctx.getImageData(0, 0, 64, 36).data;

      function getPixel(x, y) {
        const idx = (y * 64 + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        return {
          r, g, b,
          lum: 0.299 * r + 0.587 * g + 0.114 * b
        };
      }

      function analyzeRect(x0, y0, x1, y1) {
        let totalLum = 0, count = 0, totalDiff = 0;
        let rSum = 0, gSum = 0, bSum = 0;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const p = getPixel(x, y);
            totalLum += p.lum;
            rSum += p.r;
            gSum += p.g;
            bSum += p.b;
            count++;

            if (x < x1 - 1) {
              const nextP = getPixel(x + 1, y);
              totalDiff += Math.abs(p.lum - nextP.lum);
            }
          }
        }
        return {
          avgLum: totalLum / count,
          complexity: totalDiff / count,
          r: rSum / count,
          g: gSum / count,
          b: bSum / count
        };
      }

      // Regiões da Tela 16:9
      const topCenter = analyzeRect(18, 2, 46, 14);
      const center = analyzeRect(18, 12, 46, 26);
      const topLeft = analyzeRect(2, 2, 24, 14);
      const midLeft = analyzeRect(2, 12, 24, 26);
      const overall = analyzeRect(0, 0, 64, 36);

      const hsl = rgbToHsl(overall.r, overall.g, overall.b);
      const hue = Math.round(hsl.h * 360);
      const sat = Math.round(hsl.s * 100);

      let chosenLayout = "layout-vertical";
      let chosenPos = "pos-center";
      let sampleArea = center;

      // 1. Centro e topo limpos: Vertical Stacked no centro (estilo One UI / iOS Lock Screen)
      if (topCenter.complexity < 8 && center.complexity < 9.5) {
        chosenLayout = "layout-vertical";
        chosenPos = "pos-center";
        sampleArea = center;
      }
      // 2. Centro ocupado com detalhe/personagem, mas céu/topo livre: Horizontal no topo centro
      else if (topCenter.complexity < 9.5) {
        chosenLayout = "layout-horizontal";
        chosenPos = "pos-top-center";
        sampleArea = topCenter;
      }
      // 3. Topo central ocupado, mas topo esquerdo livre: Horizontal no topo esquerdo
      else if (topLeft.complexity < topCenter.complexity && topLeft.complexity < 9.5) {
        chosenLayout = "layout-horizontal";
        chosenPos = "pos-top-left";
        sampleArea = topLeft;
      }
      // 4. Lateral esquerda com faixa vertical limpa: Vertical Stacked no canto esquerdo
      else if (midLeft.complexity < 8.5) {
        chosenLayout = "layout-vertical";
        chosenPos = "pos-center-left";
        sampleArea = midLeft;
      }
      // 5. Fallback horizontal
      else {
        chosenLayout = "layout-horizontal";
        chosenPos = "pos-top-center";
        sampleArea = topCenter;
      }

      // Cálculo de Cores Harmônicas e Contraste com o Wallpaper
      const isDark = sampleArea.avgLum < 135;
      let clockColor, clockShadow;

      if (isDark) {
        const displaySat = Math.min(sat, 60);
        clockColor = `hsl(${hue}, ${displaySat}%, 92%)`;
        clockShadow = `0 10px 45px hsla(${hue}, 85%, 50%, 0.45)`;
      } else {
        const displaySat = Math.min(sat, 70);
        clockColor = `hsl(${hue}, ${displaySat}%, 14%)`;
        clockShadow = `0 3px 20px rgba(255, 255, 255, 0.60)`;
      }

      document.documentElement.style.setProperty("--clock-adaptive-color", clockColor);
      document.documentElement.style.setProperty("--clock-adaptive-shadow", clockShadow);

      const adaptiveClock = document.getElementById("adaptive-clock");
      if (adaptiveClock) {
        adaptiveClock.className = `adaptive-clock ${chosenLayout} ${chosenPos}`;
        updateHudDockPosition(chosenPos);
      }
    } catch (err) {
      console.warn("Análise de wallpaper ignorada ou falhou:", err);
    }
  };
  img.src = imageSrc;
}

// =========================================================
// 8C. CONTROLE AVANÇADO DE WALLPAPERS & CONFIGURAÇÕES
// =========================================================
let currentWpIndex = 0;
let activeLayer = "a";
let isWallpaperRotationActive = localStorage.getItem("ambient_rotation_active") !== "false";
let currentWallpaperInterval = parseInt(localStorage.getItem("ambient_rotation_interval") || "90000", 10);
let wallpaperTimerId = null;

function updateWallpaperCounter() {
  const counterEl = document.getElementById("wallpaper-counter");
  if (counterEl) {
    counterEl.textContent = `${currentWpIndex + 1} / ${WALLPAPERS.length}`;
  }
}

function setWallpaperByIndex(index) {
  if (index < 0 || index >= WALLPAPERS.length) return;
  currentWpIndex = index;
  const nextWallpaper = WALLPAPERS[currentWpIndex];

  const layerA = document.getElementById("bg-layer-a");
  const layerB = document.getElementById("bg-layer-b");
  if (!layerA || !layerB) return;

  const targetLayer = activeLayer === "a" ? layerB : layerA;
  const currentLayer = activeLayer === "a" ? layerA : layerB;

  const preloadImg = new Image();
  preloadImg.onload = () => {
    targetLayer.style.backgroundImage = `url('${nextWallpaper}')`;
    targetLayer.classList.add("active");
    currentLayer.classList.remove("active");
    activeLayer = activeLayer === "a" ? "b" : "a";
    analyzeWallpaperAndAdapt(nextWallpaper);
  };
  preloadImg.onerror = () => {
    if (window.BUNDLED_WALLPAPERS && window.BUNDLED_WALLPAPERS.length > 0) {
      const fallback = window.BUNDLED_WALLPAPERS[currentWpIndex % window.BUNDLED_WALLPAPERS.length];
      targetLayer.style.backgroundImage = `url('${fallback}')`;
      targetLayer.classList.add("active");
      currentLayer.classList.remove("active");
      activeLayer = activeLayer === "a" ? "b" : "a";
      analyzeWallpaperAndAdapt(fallback);
    }
  };
  preloadImg.src = nextWallpaper;

  updateWallpaperCounter();
  highlightActiveGalleryThumbnail();
}

let selectedCarouselIndices = new Set();
try {
  const defaultTs = (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.timestamp) || 0;
  const savedTs = parseInt(localStorage.getItem("ambient_config_timestamp") || "0", 10);

  if (window.DEFAULT_CONFIG && defaultTs > savedTs && Array.isArray(window.DEFAULT_CONFIG.selectedCarousel) && window.DEFAULT_CONFIG.selectedCarousel.length > 0) {
    // Nova configuração padrão configurada no computador (localhost)
    selectedCarouselIndices = new Set(window.DEFAULT_CONFIG.selectedCarousel);
    localStorage.setItem("ambient_config_timestamp", defaultTs);
    localStorage.setItem("ambient_carousel_selected", JSON.stringify(Array.from(selectedCarouselIndices)));
    if (window.DEFAULT_CONFIG.rotationInterval) {
      currentWallpaperInterval = window.DEFAULT_CONFIG.rotationInterval;
      localStorage.setItem("ambient_rotation_interval", currentWallpaperInterval);
    }
    if (window.DEFAULT_CONFIG.rotationActive !== undefined) {
      isWallpaperRotationActive = window.DEFAULT_CONFIG.rotationActive;
      localStorage.setItem("ambient_rotation_active", isWallpaperRotationActive);
    }
  } else {
    const saved = localStorage.getItem("ambient_carousel_selected");
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        selectedCarouselIndices = new Set(parsed);
      }
    } else if (window.DEFAULT_CONFIG && Array.isArray(window.DEFAULT_CONFIG.selectedCarousel) && window.DEFAULT_CONFIG.selectedCarousel.length > 0) {
      selectedCarouselIndices = new Set(window.DEFAULT_CONFIG.selectedCarousel);
    } else {
      WALLPAPERS.forEach((_, idx) => selectedCarouselIndices.add(idx));
    }
  }
} catch (e) {
  WALLPAPERS.forEach((_, idx) => selectedCarouselIndices.add(idx));
}

function syncConfigToLocalProject(showFeedback = false) {
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;
  const payload = {
    timestamp: Date.now(),
    selectedCarousel: Array.from(selectedCarouselIndices),
    rotationInterval: currentWallpaperInterval,
    rotationActive: isWallpaperRotationActive,
    displayLevel: currentDisplayLevel,
    newsFeed: currentNewsFeed
  };

  fetch("/api/save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(res => {
    if (res.ok) {
      console.log(`[Sync] Configuração salva no projeto (${res.count} itens no carrossel)`);
    }
  })
  .catch(err => {
    console.warn("[Sync] API local não disponível ou offline:", err);
  });
}

function saveCarouselSelection() {
  try {
    localStorage.setItem("ambient_carousel_selected", JSON.stringify(Array.from(selectedCarouselIndices)));
  } catch (e) {}
  updateGallerySelectionCount();
  syncConfigToLocalProject();
}

function updateGallerySelectionCount() {
  const badge = document.getElementById("gallery-selected-badge");
  if (badge) {
    if (selectedCarouselIndices.size === 0) {
      badge.textContent = `0 no Carrossel (Pausado)`;
      badge.style.color = "var(--text-tertiary)";
      badge.style.borderColor = "rgba(255, 255, 255, 0.15)";
      badge.style.background = "rgba(255, 255, 255, 0.05)";
    } else {
      badge.textContent = `${selectedCarouselIndices.size} no Carrossel`;
      badge.style.color = "var(--cyan)";
      badge.style.borderColor = "rgba(34, 211, 238, 0.30)";
      badge.style.background = "rgba(34, 211, 238, 0.12)";
    }
  }
  const countEl = document.getElementById("settings-gallery-count");
  if (countEl) {
    countEl.textContent = `${WALLPAPERS.length} Wallpapers`;
  }

  // Atualizar botões de Marcar Todos / Desmarcar Todos
  const selectAllBtn = document.getElementById("btn-select-all-wp");
  const deselectAllBtn = document.getElementById("btn-deselect-all-wp");

  if (selectAllBtn) {
    if (selectedCarouselIndices.size === WALLPAPERS.length) {
      selectAllBtn.classList.add("disabled");
      selectAllBtn.title = "Todos os 120 wallpapers já estão no carrossel";
    } else {
      selectAllBtn.classList.remove("disabled");
      selectAllBtn.title = "Marcar todos os 120 wallpapers no carrossel";
    }
  }

  if (deselectAllBtn) {
    if (selectedCarouselIndices.size === 0) {
      deselectAllBtn.classList.add("disabled");
      deselectAllBtn.title = "Nenhum wallpaper está selecionado no carrossel";
    } else {
      deselectAllBtn.classList.remove("disabled");
      deselectAllBtn.title = "Desmarcar todos os wallpapers do carrossel";
    }
  }
}

function toggleCarouselIndex(idx) {
  if (selectedCarouselIndices.has(idx)) {
    selectedCarouselIndices.delete(idx);
  } else {
    selectedCarouselIndices.add(idx);
  }
  saveCarouselSelection();
  renderSettingsGallery();
}

function selectAllWallpapers() {
  WALLPAPERS.forEach((_, idx) => selectedCarouselIndices.add(idx));
  saveCarouselSelection();
  renderSettingsGallery();
}

function deselectAllWallpapers() {
  selectedCarouselIndices.clear();
  saveCarouselSelection();
  renderSettingsGallery();
}

function cycleWallpaper(direction = 1) {
  if (isModalOpen) return;
  // Se houver seleção no carrossel, navega dentro da seleção; caso contrário, navega por todas as imagens
  const list = selectedCarouselIndices.size > 0
    ? Array.from(selectedCarouselIndices).sort((a, b) => a - b)
    : WALLPAPERS.map((_, i) => i);

  if (!list || list.length === 0) return;

  if (direction === -1) {
    // Voltar para o wallpaper anterior
    const prevIndices = list.filter(idx => idx < currentWpIndex);
    const prevIdx = prevIndices.length > 0
      ? prevIndices[prevIndices.length - 1]
      : list[list.length - 1];
    setWallpaperByIndex(prevIdx);
  } else {
    // Avançar para o próximo wallpaper
    const nextIdx = list.find(idx => idx > currentWpIndex);
    setWallpaperByIndex(nextIdx !== undefined ? nextIdx : list[0]);
  }
}

function startWallpaperRotation() {
  if (wallpaperTimerId) clearInterval(wallpaperTimerId);
  if (isWallpaperRotationActive) {
    wallpaperTimerId = setInterval(() => {
      if (!isModalOpen) {
        cycleWallpaper();
      }
    }, currentWallpaperInterval);
  }
}

function setRotationInterval(timeMs) {
  currentWallpaperInterval = timeMs;
  try {
    localStorage.setItem("ambient_rotation_interval", timeMs);
  } catch (e) {}
  startWallpaperRotation();
  updateIntervalPillUI();
  syncConfigToLocalProject();
}

function toggleWallpaperRotation() {
  isWallpaperRotationActive = !isWallpaperRotationActive;
  try {
    localStorage.setItem("ambient_rotation_active", isWallpaperRotationActive);
  } catch (e) {}
  updateRotationToggleUI();
  startWallpaperRotation();
  syncConfigToLocalProject();
}

// Modais de Configurações
function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  isModalOpen = true;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  renderSettingsGallery();
  updateRotationToggleUI();
  updateIntervalPillUI();
  updateNewsFeedPillsUI();

  if (window.lucide && lucide.createIcons) {
    lucide.createIcons();
  }

  // Foco inicial no botão de alternar rotação
  const toggleBtn = document.getElementById("btn-toggle-rotation");
  if (toggleBtn) toggleBtn.focus();
}

function closeSettingsModal() {
  if (isCustomIntervalModalOpen) {
    closeCustomIntervalModal();
  }
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  isModalOpen = false;

  // Devolve o foco para o botão de abrir configurações
  const openBtn = document.getElementById("settings-open-btn");
  if (openBtn) openBtn.focus();
}

function updateRotationToggleUI() {
  const toggleBtn = document.getElementById("btn-toggle-rotation");
  const toggleIcon = document.getElementById("icon-toggle-rotation");
  const toggleLabel = document.getElementById("label-toggle-rotation");

  if (!toggleBtn) return;
  if (isWallpaperRotationActive) {
    toggleBtn.classList.add("active");
    if (toggleLabel) toggleLabel.textContent = "Rotação: Ativada";
    if (toggleIcon) toggleIcon.setAttribute("data-lucide", "play");
  } else {
    toggleBtn.classList.remove("active");
    if (toggleLabel) toggleLabel.textContent = "Rotação: Pausada";
    if (toggleIcon) toggleIcon.setAttribute("data-lucide", "pause");
  }
  if (window.lucide && lucide.createIcons) lucide.createIcons();
}

function formatIntervalDisplay(timeMs) {
  if (timeMs < 60000) {
    return `${Math.round(timeMs / 1000)}s`;
  }
  const minutes = timeMs / 60000;
  if (minutes < 60) {
    const formattedMin = Number.isInteger(minutes) ? minutes : minutes.toFixed(1);
    return `${formattedMin} min`;
  }
  const hours = timeMs / 3600000;
  const formattedHours = Number.isInteger(hours) ? hours : hours.toFixed(1);
  return `${formattedHours}h`;
}

function updateIntervalPillUI() {
  const pills = document.querySelectorAll("#rotation-interval-group .settings-pill-btn:not(#btn-custom-interval)");
  let matched = false;
  pills.forEach(pill => {
    const time = parseInt(pill.getAttribute("data-time"), 10);
    if (time === currentWallpaperInterval) {
      pill.classList.add("active");
      pill.setAttribute("aria-checked", "true");
      matched = true;
    } else {
      pill.classList.remove("active");
      pill.setAttribute("aria-checked", "false");
    }
  });

  const customBtn = document.getElementById("btn-custom-interval");
  if (customBtn) {
    if (!matched) {
      customBtn.classList.add("active");
      customBtn.setAttribute("aria-checked", "true");
      customBtn.textContent = `⏱️ ${formatIntervalDisplay(currentWallpaperInterval)}`;
    } else {
      customBtn.classList.remove("active");
      customBtn.setAttribute("aria-checked", "false");
      customBtn.textContent = "⏱️ Personalizado...";
    }
  }
}

// Sub-Modal de Tempo Personalizado
let isCustomIntervalModalOpen = false;
let customIntervalUnit = "m"; // "s", "m", "h"

function openCustomIntervalModal() {
  const modal = document.getElementById("custom-interval-modal");
  if (!modal) return;

  isCustomIntervalModalOpen = true;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  const input = document.getElementById("input-custom-interval-value");
  if (currentWallpaperInterval < 60000) {
    customIntervalUnit = "s";
    if (input) input.value = Math.max(5, Math.round(currentWallpaperInterval / 1000));
  } else if (currentWallpaperInterval % 3600000 === 0 && currentWallpaperInterval >= 3600000) {
    customIntervalUnit = "h";
    if (input) input.value = Math.max(1, Math.round(currentWallpaperInterval / 3600000));
  } else {
    customIntervalUnit = "m";
    if (input) input.value = Math.max(1, Math.round(currentWallpaperInterval / 60000));
  }

  updateCustomUnitUI();
  updateCustomIntervalPreview();

  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

function closeCustomIntervalModal() {
  const modal = document.getElementById("custom-interval-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  isCustomIntervalModalOpen = false;

  const customBtn = document.getElementById("btn-custom-interval");
  if (customBtn) customBtn.focus();
}

function updateCustomUnitUI() {
  const unitButtons = document.querySelectorAll(".unit-pill-btn");
  unitButtons.forEach(btn => {
    if (btn.getAttribute("data-unit") === customIntervalUnit) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const unitLabel = document.getElementById("custom-interval-unit-text");
  if (unitLabel) {
    if (customIntervalUnit === "s") unitLabel.textContent = "segundos";
    else if (customIntervalUnit === "m") unitLabel.textContent = "minutos";
    else if (customIntervalUnit === "h") unitLabel.textContent = "horas";
  }
}

function getComputedCustomIntervalMs() {
  const input = document.getElementById("input-custom-interval-value");
  const rawVal = parseFloat(input ? input.value : "10") || 1;
  const val = Math.max(1, rawVal);

  let ms = val * 60000;
  if (customIntervalUnit === "s") {
    ms = Math.max(5000, Math.round(val * 1000));
  } else if (customIntervalUnit === "m") {
    ms = Math.round(val * 60000);
  } else if (customIntervalUnit === "h") {
    ms = Math.round(val * 3600000);
  }
  return ms;
}

function updateCustomIntervalPreview() {
  const preview = document.getElementById("custom-interval-computed-preview");
  if (!preview) return;
  const ms = getComputedCustomIntervalMs();
  let text = "";
  if (ms < 60000) {
    text = `${Math.round(ms / 1000)} segundos`;
  } else if (ms < 3600000) {
    const mins = (ms / 60000);
    text = `${Number.isInteger(mins) ? mins : mins.toFixed(1)} minutos (${Math.round(ms / 1000)}s)`;
  } else {
    const hrs = (ms / 3600000);
    const mins = Math.round(ms / 60000);
    text = `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} horas (${mins} min)`;
  }
  preview.textContent = text;
}

function stepCustomInterval(delta) {
  const input = document.getElementById("input-custom-interval-value");
  if (!input) return;
  let val = parseInt(input.value, 10) || 1;
  val = Math.max(1, val + delta);
  input.value = val;
  updateCustomIntervalPreview();
}

function applyCustomInterval() {
  const ms = getComputedCustomIntervalMs();
  setRotationInterval(ms);
  closeCustomIntervalModal();
}

function renderSettingsGallery() {
  const grid = document.getElementById("settings-gallery-grid");
  if (!grid) return;

  grid.innerHTML = "";
  updateGallerySelectionCount();

  const selectAllBtn = document.getElementById("btn-select-all-wp");
  if (selectAllBtn) {
    selectAllBtn.onclick = (e) => {
      e.preventDefault();
      selectAllWallpapers();
    };
  }

  const deselectAllBtn = document.getElementById("btn-deselect-all-wp");
  if (deselectAllBtn) {
    deselectAllBtn.onclick = (e) => {
      e.preventDefault();
      deselectAllWallpapers();
    };
  }

  const syncTvBtn = document.getElementById("btn-sync-tv-config");
  if (syncTvBtn) {
    syncTvBtn.onclick = (e) => {
      e.preventDefault();
      syncConfigToLocalProject(true);
      const originalText = syncTvBtn.textContent;
      syncTvBtn.textContent = "✓ Sincronizado!";
      syncTvBtn.style.color = "#4ade80";
      syncTvBtn.style.borderColor = "#4ade80";
      setTimeout(() => {
        syncTvBtn.textContent = originalText;
        syncTvBtn.style.color = "var(--cyan)";
        syncTvBtn.style.borderColor = "rgba(34, 211, 238, 0.4)";
      }, 2000);
    };
  }

  WALLPAPERS.forEach((wpUrl, idx) => {
    const card = document.createElement("div");
    card.className = `settings-wp-card ${idx === currentWpIndex ? "active-wp" : ""}`;

    const thumbBtn = document.createElement("button");
    thumbBtn.className = "settings-wp-thumb tv-focusable";
    thumbBtn.dataset.cardIdx = idx;
    let thumbUrl = wpUrl.replace("assets/wallpapers/", "assets/thumbnails/");
    if (wpUrl.startsWith("http")) {
      const meta = (window.DAILY_WALLPAPERS_METADATA || []).find(m => m.url === wpUrl);
      if (meta && meta.thumb) thumbUrl = meta.thumb;
    }
    thumbBtn.style.backgroundImage = `url('${thumbUrl}')`;
    thumbBtn.title = `Wallpaper ${idx + 1}: Clique ou OK para exibir agora`;
    thumbBtn.setAttribute("aria-label", `Wallpaper ${idx + 1}: Exibir na tela`);
    thumbBtn.tabIndex = 0;

    thumbBtn.addEventListener("focus", () => {
      thumbBtn.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });

    if (idx === currentWpIndex) {
      const activeTag = document.createElement("span");
      activeTag.className = "thumb-active-tag";
      activeTag.textContent = "ATIVO";
      thumbBtn.appendChild(activeTag);
    }

    thumbBtn.addEventListener("click", () => {
      setWallpaperByIndex(idx);
    });
    thumbBtn.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        setWallpaperByIndex(idx);
        e.preventDefault();
      } else if (e.keyCode === 32 || e.key === "c" || e.key === "C" || e.keyCode === 415) {
        toggleCarouselIndex(idx);
        e.preventDefault();
      }
    });

    const toggleBtn = document.createElement("button");
    const isInCarousel = selectedCarouselIndices.has(idx);
    toggleBtn.className = `thumb-carousel-toggle tv-focusable ${isInCarousel ? "in-carousel" : ""}`;
    toggleBtn.dataset.cardIdx = idx;
    toggleBtn.dataset.type = "toggle";
    toggleBtn.tabIndex = 0;
    toggleBtn.innerHTML = isInCarousel ? "✓ No Carrossel" : "○ Não incluir";
    toggleBtn.setAttribute("aria-label", `Wallpaper ${idx + 1}: ${isInCarousel ? "Incluído no carrossel" : "Não incluído"}`);
    toggleBtn.setAttribute("aria-pressed", isInCarousel ? "true" : "false");
    toggleBtn.title = "Alternar presença no carrossel (OK)";

    toggleBtn.addEventListener("focus", () => {
      toggleBtn.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCarouselIndex(idx);
    });
    toggleBtn.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter" || e.keyCode === 32) {
        e.stopPropagation();
        toggleCarouselIndex(idx);
        e.preventDefault();
      }
    });

    card.appendChild(thumbBtn);
    card.appendChild(toggleBtn);
    grid.appendChild(card);
  });
}

function highlightActiveGalleryThumbnail() {
  const cards = document.querySelectorAll("#settings-gallery-grid .settings-wp-card");
  cards.forEach((card, idx) => {
    if (idx === currentWpIndex) {
      card.classList.add("active-wp");
    } else {
      card.classList.remove("active-wp");
    }
  });
}

// =========================================================
// 9. MOTOR ANTI-BURN-IN (PIXEL SHIFT)
// =========================================================
function applyPixelShift() {
  const shiftX = (Math.random() * (CONFIG.shiftMaxX * 2) - CONFIG.shiftMaxX).toFixed(1);
  const shiftY = (Math.random() * (CONFIG.shiftMaxY * 2) - CONFIG.shiftMaxY).toFixed(1);

  document.documentElement.style.setProperty("--shift-x", `${shiftX}px`);
  document.documentElement.style.setProperty("--shift-y", `${shiftY}px`);
}

// =========================================================
// 10. INICIALIZAÇÃO & EVENTOS DE CONTROLE
// =========================================================
function init() {
  // 0. Previne suspensão da tela pelo gerenciador de energia do Tizen OS (WakeLock)
  if (window.tizen && tizen.power) {
    try {
      tizen.power.request("SCREEN", "SCREEN_NORMAL");
      console.log("[Power] Tizen Screen WakeLock ativado: o app permanecerá ligado indefinidamente.");
    } catch (e) {
      console.warn("[Power] Aviso ao solicitar WakeLock Tizen:", e);
    }
  }

  // Inicializa o primeiro wallpaper (respeitando URL query param ou seleção do carrossel)
  let initialWpIdx = (selectedCarouselIndices.size > 0 && !selectedCarouselIndices.has(0))
    ? Array.from(selectedCarouselIndices).sort((a, b) => a - b)[0]
    : 0;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("wp")) {
      const targetQuery = urlParams.get("wp").toLowerCase();
      const foundIdx = WALLPAPERS.findIndex(w => w.toLowerCase().includes(targetQuery));
      if (foundIdx !== -1) initialWpIdx = foundIdx;
    } else if (urlParams.has("wpIndex")) {
      const idx = parseInt(urlParams.get("wpIndex"), 10);
      if (!isNaN(idx) && idx >= 0 && idx < WALLPAPERS.length) initialWpIdx = idx;
    }
    if (urlParams.get("news") === "1") {
      setTimeout(() => openNewsModal(0), 600);
    } else if (urlParams.get("settings") === "1") {
      setTimeout(() => openSettingsModal(), 600);
    }
  } catch (e) {}
  currentWpIndex = initialWpIdx;
  const layerA = document.getElementById("bg-layer-a");
  if (layerA) {
    layerA.style.backgroundImage = `url('${WALLPAPERS[currentWpIndex]}')`;
    layerA.classList.add("active");
  }
  updateWallpaperCounter();

  // Relógio & Data
  updateClock();
  setInterval(updateClock, 1000);

  // Clima & Atmosfera de Londrina
  fetchWeather();
  setInterval(fetchWeather, CONFIG.weatherUpdateInterval);

  // Geolocalização Precisa com Bairro (Guanabara · Londrina, PR)
  fetchPreciseLocation();
  setInterval(fetchPreciseLocation, 6 * 3600 * 1000);

  // Cotações Financeiras (USD, EUR, BTC)
  fetchMarketData();
  setInterval(fetchMarketData, CONFIG.financeUpdateInterval);

  // Streaming com Pôster
  renderStreamingItem();
  streamProgressStart = Date.now();
  requestAnimationFrame(updateStreamingProgressBar);

  // Notícias com Thumbnail, Ciclo & Auto-Refresh a cada 20 min
  renderCurrentNews();
  fetchLiveNews();
  setInterval(fetchLiveNews, CONFIG.newsRefreshInterval);
  newsProgressStart = Date.now();
  requestAnimationFrame(updateNewsProgressBar);

  // Auto-refresh autônomo quando a tela/TV retomar foco
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (Date.now() - lastNewsFetchTime > CONFIG.newsRefreshInterval) {
        fetchLiveNews();
      }
    }
  });

  // Ciclo Automático e Configurável de Wallpapers
  startWallpaperRotation();

  // Anti-Burn-In (Pixel Shift a cada 5m)
  setInterval(applyPixelShift, CONFIG.pixelShiftInterval);

  // Botão de Troca de Wallpaper Discreto
  const switcherBtn = document.getElementById("wallpaper-switcher-btn");
  if (switcherBtn) {
    switcherBtn.addEventListener("click", cycleWallpaper);
  }

  // Botão de Configurações & Wallpapers (Menu Modal)
  const settingsOpenBtn = document.getElementById("settings-open-btn");
  if (settingsOpenBtn) {
    settingsOpenBtn.addEventListener("click", openSettingsModal);
    settingsOpenBtn.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        openSettingsModal();
        e.preventDefault();
      }
    });
  }

  // Botão de Alternância de Modos (3 Níveis de Exibição / Ghost Eye)
  const zenBtn = document.getElementById("zen-mode-btn");
  if (zenBtn) {
    zenBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cycleDisplayLevel();
      resetControlsHudTimer();
    });
  }

  // Auto-Hide HUD nos botões de controle do topo (Esconde após 4.5s de inatividade nos modos limpos)
  window.addEventListener("keydown", resetControlsHudTimer, true);
  window.addEventListener("mousemove", resetControlsHudTimer, true);
  if (zenBtn) zenBtn.addEventListener("blur", () => resetControlsHudTimer());
  if (settingsOpenBtn) settingsOpenBtn.addEventListener("blur", () => resetControlsHudTimer());
  if (switcherBtn) switcherBtn.addEventListener("blur", () => resetControlsHudTimer());
  resetControlsHudTimer();

  // Controles do Modal de Configurações
  const closeSettingsBtn = document.getElementById("modal-close-settings");
  if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettingsModal);

  const toggleRotationBtn = document.getElementById("btn-toggle-rotation");
  if (toggleRotationBtn) {
    toggleRotationBtn.addEventListener("click", toggleWallpaperRotation);
    toggleRotationBtn.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        toggleWallpaperRotation();
        e.preventDefault();
      }
    });
  }

  const intervalPills = document.querySelectorAll("#rotation-interval-group .settings-pill-btn");
  intervalPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const timeAttr = pill.getAttribute("data-time");
      if (timeAttr === "custom") {
        openCustomIntervalModal();
        return;
      }
      const time = parseInt(timeAttr, 10);
      if (!isNaN(time)) setRotationInterval(time);
    });
    pill.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        const timeAttr = pill.getAttribute("data-time");
        if (timeAttr === "custom") {
          openCustomIntervalModal();
          e.preventDefault();
          return;
        }
        const time = parseInt(timeAttr, 10);
        if (!isNaN(time)) setRotationInterval(time);
        e.preventDefault();
      }
    });
  });

  // Eventos das Pílulas de Fonte de Notícias (Google News / G1)
  const newsPills = document.querySelectorAll("#news-feed-group .settings-pill-btn");
  newsPills.forEach((pill) => {
    const handleNewsFeedSelect = () => {
      const feedKey = pill.getAttribute("data-feed");
      if (feedKey && NEWS_FEEDS[feedKey]) {
        setNewsFeed(feedKey);
      }
    };
    pill.addEventListener("click", handleNewsFeedSelect);
    pill.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        handleNewsFeedSelect();
        e.preventDefault();
      }
    });
  });

  // Eventos do Sub-Modal de Tempo Personalizado
  const closeCustomBtn = document.getElementById("btn-close-custom-interval");
  if (closeCustomBtn) closeCustomBtn.addEventListener("click", closeCustomIntervalModal);

  const cancelCustomBtn = document.getElementById("btn-cancel-custom-interval");
  if (cancelCustomBtn) cancelCustomBtn.addEventListener("click", closeCustomIntervalModal);

  const confirmCustomBtn = document.getElementById("btn-confirm-custom-interval");
  if (confirmCustomBtn) confirmCustomBtn.addEventListener("click", applyCustomInterval);

  const stepMinusBtn = document.getElementById("btn-interval-step-minus");
  if (stepMinusBtn) stepMinusBtn.addEventListener("click", () => stepCustomInterval(-1));

  const stepPlusBtn = document.getElementById("btn-interval-step-plus");
  if (stepPlusBtn) stepPlusBtn.addEventListener("click", () => stepCustomInterval(1));

  const customInput = document.getElementById("input-custom-interval-value");
  if (customInput) {
    customInput.addEventListener("input", updateCustomIntervalPreview);
    customInput.addEventListener("change", updateCustomIntervalPreview);
    customInput.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        applyCustomInterval();
        e.preventDefault();
      }
    });
  }

  const unitButtons = document.querySelectorAll(".unit-pill-btn");
  unitButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      customIntervalUnit = btn.getAttribute("data-unit") || "m";
      updateCustomUnitUI();
      updateCustomIntervalPreview();
    });
  });

  const quickStepButtons = document.querySelectorAll(".quick-step-btn");
  quickStepButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const addMins = parseInt(btn.getAttribute("data-add"), 10) || 0;
      if (customIntervalUnit !== "m") {
        customIntervalUnit = "m";
        updateCustomUnitUI();
      }
      stepCustomInterval(addMins);
    });
  });

  const customModal = document.getElementById("custom-interval-modal");
  if (customModal) {
    customModal.addEventListener("click", (e) => {
      const card = document.getElementById("custom-interval-card");
      if (card && !card.contains(e.target)) {
        closeCustomIntervalModal();
      }
    });
  }

  const settingsModal = document.getElementById("settings-modal");
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      const card = document.getElementById("settings-modal-card");
      if (card && !card.contains(e.target)) {
        closeSettingsModal();
      }
    });
  }

  // Inicializa Ícones Modernos (Lucide)
  if (window.lucide && lucide.createIcons) {
    lucide.createIcons();
  }

  // Aplica o Nível de Exibição Salvo (2: Completo, 1: Adaptativo, 0: Zen)
  setDisplayLevel(currentDisplayLevel, false);

  // Executa Análise Inteligente no Primeiro Wallpaper
  analyzeWallpaperAndAdapt(WALLPAPERS[currentWpIndex]);

  // Suporte a preview de depuração
  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    if (params.has("wp")) {
      const wpIdx = parseInt(params.get("wp"), 10);
      if (!isNaN(wpIdx)) setWallpaperByIndex(wpIdx);
    }
    if (params.has("level")) {
      const lvl = parseInt(params.get("level"), 10);
      if (!isNaN(lvl)) setDisplayLevel(lvl, false);
    }
    if (params.get("openSettings") === "1") {
      openSettingsModal();
    }
    if (params.get("openCustom") === "1") {
      openSettingsModal();
      openCustomIntervalModal();
    }
    if (params.get("openNews") === "1") {
      openNewsModal();
    }
  }

  // Interatividade: Abrir Modal de Streaming ao clicar no Card
  const streamingCard = document.getElementById("streaming-card");
  if (streamingCard) {
    streamingCard.addEventListener("click", () => openStreamingModal(streamIndex));
    streamingCard.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        openStreamingModal(streamIndex);
      }
    });
  }

  // Interatividade: Abrir Modal de Notícias ao clicar no Card
  const newsCard = document.getElementById("news-card");
  if (newsCard) {
    newsCard.addEventListener("click", openNewsModal);
    newsCard.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        openNewsModal();
      }
    });
  }

  // Controles do Modal de Streaming
  const closeStreamBtn = document.getElementById("modal-close-streaming");
  if (closeStreamBtn) closeStreamBtn.addEventListener("click", closeStreamingModal);

  const openStreamBtn = document.getElementById("btn-open-service");
  if (openStreamBtn) {
    openStreamBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const item = STREAMING_ITEMS[modalStreamIndex % STREAMING_ITEMS.length];
      if (item) launchStreamingService(item.deepLink);
    });
    openStreamBtn.addEventListener("keydown", (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        e.preventDefault();
        const item = STREAMING_ITEMS[modalStreamIndex % STREAMING_ITEMS.length];
        if (item) launchStreamingService(item.deepLink);
      }
    });
  }

  const prevBtn = document.getElementById("btn-modal-prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      modalStreamIndex = (modalStreamIndex - 1 + STREAMING_ITEMS.length) % STREAMING_ITEMS.length;
      updateStreamingModalContent();
    });
  }

  const nextBtn = document.getElementById("btn-modal-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      modalStreamIndex = (modalStreamIndex + 1) % STREAMING_ITEMS.length;
      updateStreamingModalContent();
    });
  }

  // Controles do Modal de Notícias
  const closeNewsBtn = document.getElementById("modal-close-news");
  if (closeNewsBtn) closeNewsBtn.addEventListener("click", closeNewsModal);

  const prevNewsBtn = document.getElementById("btn-modal-news-prev");
  if (prevNewsBtn) {
    prevNewsBtn.addEventListener("click", () => {
      if (newsArticles.length > 0) {
        modalNewsIndex = (modalNewsIndex - 1 + newsArticles.length) % newsArticles.length;
        updateNewsModalContent();
      }
    });
  }

  const nextNewsBtn = document.getElementById("btn-modal-news-next");
  if (nextNewsBtn) {
    nextNewsBtn.addEventListener("click", () => {
      if (newsArticles.length > 0) {
        modalNewsIndex = (modalNewsIndex + 1) % newsArticles.length;
        updateNewsModalContent();
      }
    });
  }

  // Clique fora do card fecha instantaneamente o modal
  const streamModal = document.getElementById("streaming-modal");
  if (streamModal) {
    streamModal.addEventListener("click", (e) => {
      const card = document.getElementById("streaming-modal-card");
      if (card && !card.contains(e.target)) {
        closeStreamingModal();
      }
    });
  }

  const newsModal = document.getElementById("news-modal");
  if (newsModal) {
    newsModal.addEventListener("click", (e) => {
      const card = document.getElementById("news-modal-card");
      if (card && !card.contains(e.target)) {
        closeNewsModal();
      }
    });
  }

  // =========================================================
  // SISTEMA COMPLETO DE NAVEGAÇÃO ESPACIAL (CONTROLE REMOTO TIZEN / 10-FOOT UI)
  // =========================================================
  window.addEventListener("keydown", (e) => {
    const settingsModal = document.getElementById("settings-modal");
    const streamModal = document.getElementById("streaming-modal");
    const newsModal = document.getElementById("news-modal");

    // 0. Sub-modal de Tempo Personalizado (Return Samsung ou ESC)
    if (isCustomIntervalModalOpen) {
      if (e.keyCode === 27 || e.keyCode === 10009) {
        closeCustomIntervalModal();
        e.preventDefault();
        return;
      }
    }

    // 1. Tecla Voltar (Return Samsung: 10009 ou ESC: 27)
    if (e.keyCode === 27 || e.keyCode === 10009) {
      if (isModalOpen) {
        closeStreamingModal();
        closeNewsModal();
        closeSettingsModal();
        e.preventDefault();
      }
      return;
    }

    // 2. NAVEGAÇÃO NO MODAL DE CONFIGURAÇÕES
    if (isModalOpen && settingsModal && settingsModal.classList.contains("active")) {
      const toggleBtn = document.getElementById("btn-toggle-rotation");
      const pills = Array.from(document.querySelectorAll("#rotation-interval-group .settings-pill-btn"));
      const newsPills = Array.from(document.querySelectorAll("#news-feed-group .settings-pill-btn"));
      const thumbs = Array.from(document.querySelectorAll("#settings-gallery-grid .settings-wp-thumb"));
      const closeBtn = document.getElementById("modal-close-settings");

      const selectAllBtn = document.getElementById("btn-select-all-wp");
      const deselectAllBtn = document.getElementById("btn-deselect-all-wp");
      const syncTvBtn = document.getElementById("btn-sync-tv-config");

      // Navegação a partir do botão Liga/Desliga Rotação
      if (document.activeElement === toggleBtn) {
        if (e.keyCode === 39 && pills.length > 0) { // Direita -> Primeiro Pill
          pills[0].focus();
          e.preventDefault();
        } else if (e.keyCode === 40) { // Baixo -> Seletor de Notícias
          if (newsPills.length > 0) newsPills[0].focus();
          else if (selectAllBtn) selectAllBtn.focus();
          else if (thumbs.length > 0) thumbs[0].focus();
          e.preventDefault();
        } else if (e.keyCode === 38 && closeBtn) { // Cima -> Botão Fechar
          closeBtn.focus();
          e.preventDefault();
        }
        return;
      }

      // Navegação dentro do grupo de intervalo (Pills)
      const pillIdx = pills.indexOf(document.activeElement);
      if (pillIdx !== -1) {
        if (e.keyCode === 37) { // Esquerda
          if (pillIdx > 0) pills[pillIdx - 1].focus();
          else if (toggleBtn) toggleBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 39) { // Direita
          if (pillIdx < pills.length - 1) pills[pillIdx + 1].focus();
          e.preventDefault();
        } else if (e.keyCode === 40) { // Baixo -> Seletor de Notícias
          if (newsPills.length > 0) {
            const targetIdx = Math.min(pillIdx, newsPills.length - 1);
            newsPills[targetIdx].focus();
          } else if (selectAllBtn) {
            selectAllBtn.focus();
          } else if (thumbs.length > 0) {
            thumbs[0].focus();
          }
          e.preventDefault();
        } else if (e.keyCode === 38 && closeBtn) { // Cima -> Botão Fechar
          closeBtn.focus();
          e.preventDefault();
        }
        return;
      }

      // Navegação dentro do grupo de Notícias (newsPills)
      const newsIdx = newsPills.indexOf(document.activeElement);
      if (newsIdx !== -1) {
        if (e.keyCode === 37) { // Esquerda
          if (newsIdx > 0) newsPills[newsIdx - 1].focus();
          e.preventDefault();
        } else if (e.keyCode === 39) { // Direita
          if (newsIdx < newsPills.length - 1) newsPills[newsIdx + 1].focus();
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Intervalo de rotação
          if (pills.length > 0) pills[Math.min(newsIdx, pills.length - 1)].focus();
          else if (toggleBtn) toggleBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 40) { // Baixo -> Ações da Galeria
          if (selectAllBtn) selectAllBtn.focus();
          else if (thumbs.length > 0) thumbs[0].focus();
          e.preventDefault();
        }
        return;
      }

      // Navegação Espacial 2D na Galeria de Miniaturas & Checkboxes do Carrossel (5 Colunas)
      const allThumbs = Array.from(document.querySelectorAll("#settings-gallery-grid .settings-wp-thumb"));
      const allToggles = Array.from(document.querySelectorAll("#settings-gallery-grid .thumb-carousel-toggle"));

      const focusAndScroll = (el) => {
        if (!el) return;
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      };

      // Navegação nos botões de Ação em Lote (Marcar / Desmarcar Todos / Salvar)
      if (document.activeElement === selectAllBtn) {
        if (e.keyCode === 39 && deselectAllBtn) { // Direita -> Desmarcar Todos
          deselectAllBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Seletor de Notícias
          if (newsPills.length > 0) newsPills[0].focus();
          else if (pills.length > 0) pills[0].focus();
          else if (toggleBtn) toggleBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 40 && allThumbs.length > 0) { // Baixo -> Primeira miniatura
          focusAndScroll(allThumbs[0]);
          e.preventDefault();
        }
        return;
      }

      if (document.activeElement === deselectAllBtn) {
        if (e.keyCode === 37 && selectAllBtn) { // Esquerda -> Marcar Todos
          selectAllBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 39 && syncTvBtn) { // Direita -> Salvar para TV
          syncTvBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Seletor de Notícias
          if (newsPills.length > 0) newsPills[Math.min(1, newsPills.length - 1)].focus();
          else if (pills.length > 0) pills[pills.length - 1].focus();
          else if (toggleBtn) toggleBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 40 && allThumbs.length > 0) { // Baixo -> Miniatura correspondente
          focusAndScroll(allThumbs[Math.min(2, allThumbs.length - 1)]);
          e.preventDefault();
        }
        return;
      }

      if (document.activeElement === syncTvBtn) {
        if (e.keyCode === 37 && deselectAllBtn) { // Esquerda -> Desmarcar Todos
          deselectAllBtn.focus();
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Seletor de Notícias
          if (newsPills.length > 0) newsPills[newsPills.length - 1].focus();
          else if (pills.length > 0) pills[pills.length - 1].focus();
          e.preventDefault();
        } else if (e.keyCode === 40 && allThumbs.length > 0) { // Baixo -> Miniatura
          focusAndScroll(allThumbs[Math.min(4, allThumbs.length - 1)]);
          e.preventDefault();
        }
        return;
      }

      // 1. Navegação nas Miniaturas (Fila Superior de cada Card)
      const thumbIdx = allThumbs.indexOf(document.activeElement);
      if (thumbIdx !== -1) {
        if (e.keyCode === 37) { // Esquerda -> Miniatura anterior
          if (thumbIdx > 0) focusAndScroll(allThumbs[thumbIdx - 1]);
          e.preventDefault();
        } else if (e.keyCode === 39) { // Direita -> Próxima miniatura
          if (thumbIdx < allThumbs.length - 1) focusAndScroll(allThumbs[thumbIdx + 1]);
          e.preventDefault();
        } else if (e.keyCode === 40) { // Baixo -> Botão de seleção do MESMO card
          if (allToggles[thumbIdx]) focusAndScroll(allToggles[thumbIdx]);
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Linha de miniaturas anterior (-5) ou cabeçalho fixo
          if (thumbIdx >= 5) {
            focusAndScroll(allThumbs[thumbIdx - 5]);
          } else if (thumbIdx <= 1 && selectAllBtn) {
            selectAllBtn.focus();
          } else if (thumbIdx <= 3 && deselectAllBtn) {
            deselectAllBtn.focus();
          } else if (syncTvBtn) {
            syncTvBtn.focus();
          } else if (closeBtn) {
            closeBtn.focus();
          }
          e.preventDefault();
        }
        return;
      }

      // 2. Navegação nos Botões de Carrossel (Fila Inferior de cada Card)
      const toggleIdx = allToggles.indexOf(document.activeElement);
      if (toggleIdx !== -1) {
        if (e.keyCode === 37) { // Esquerda -> Toggle anterior
          if (toggleIdx > 0) focusAndScroll(allToggles[toggleIdx - 1]);
          e.preventDefault();
        } else if (e.keyCode === 39) { // Direita -> Próximo toggle
          if (toggleIdx < allToggles.length - 1) focusAndScroll(allToggles[toggleIdx + 1]);
          e.preventDefault();
        } else if (e.keyCode === 38) { // Cima -> Miniatura do MESMO card
          if (allThumbs[toggleIdx]) focusAndScroll(allThumbs[toggleIdx]);
          e.preventDefault();
        } else if (e.keyCode === 40) { // Baixo -> Miniatura da PRÓXIMA linha (+5)
          if (toggleIdx + 5 < allThumbs.length) {
            focusAndScroll(allThumbs[toggleIdx + 5]);
          } else {
            const uploadLink = document.getElementById("network-upload-url");
            if (uploadLink) uploadLink.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          e.preventDefault();
        }
        return;
      }

      // Navegação a partir do botão Fechar (✕)
      if (document.activeElement === closeBtn) {
        if (e.keyCode === 40 && toggleBtn) {
          toggleBtn.focus();
          e.preventDefault();
        }
        return;
      }

      return;
    }

    // 3. NAVEGAÇÃO NO MODAL DE STREAMING
    if (isModalOpen && streamModal && streamModal.classList.contains("active")) {
      const openBtn = document.getElementById("btn-open-service");
      const prevBtn = document.getElementById("btn-modal-prev");
      const nextBtn = document.getElementById("btn-modal-next");

      if (e.keyCode === 37) { // Seta Esquerda (Filme Anterior)
        modalStreamIndex = (modalStreamIndex - 1 + STREAMING_ITEMS.length) % STREAMING_ITEMS.length;
        updateStreamingModalContent();
        e.preventDefault();
      } else if (e.keyCode === 39) { // Seta Direita (Próximo Filme)
        modalStreamIndex = (modalStreamIndex + 1) % STREAMING_ITEMS.length;
        updateStreamingModalContent();
        e.preventDefault();
      } else if (e.keyCode === 40) { // Seta Baixo
        if (document.activeElement === openBtn && prevBtn) {
          prevBtn.focus();
          e.preventDefault();
        }
      } else if (e.keyCode === 38) { // Seta Cima
        if ((document.activeElement === prevBtn || document.activeElement === nextBtn) && openBtn) {
          openBtn.focus();
          e.preventDefault();
        }
      }
      return;
    }

    // 4. NAVEGAÇÃO NO MODAL DE NOTÍCIAS (SETAS ESQUERDA E DIREITA PARA NAVEGAR)
    if (isModalOpen && newsModal && newsModal.classList.contains("active")) {
      const closeBtn = document.getElementById("modal-close-news");
      const linkBtn = document.getElementById("modal-news-link");
      const prevBtn = document.getElementById("btn-modal-news-prev");
      const nextBtn = document.getElementById("btn-modal-news-next");

      if (e.keyCode === 37) { // Seta Esquerda (Notícia Anterior)
        if (newsArticles.length > 0) {
          modalNewsIndex = (modalNewsIndex - 1 + newsArticles.length) % newsArticles.length;
          updateNewsModalContent();
        }
        e.preventDefault();
        return;
      } else if (e.keyCode === 39) { // Seta Direita (Próxima Notícia)
        if (newsArticles.length > 0) {
          modalNewsIndex = (modalNewsIndex + 1) % newsArticles.length;
          updateNewsModalContent();
        }
        e.preventDefault();
        return;
      } else if (e.keyCode === 40) { // Seta Baixo
        if (document.activeElement === closeBtn && linkBtn) {
          linkBtn.focus();
          e.preventDefault();
        } else if (document.activeElement === linkBtn && prevBtn) {
          prevBtn.focus();
          e.preventDefault();
        }
        return;
      } else if (e.keyCode === 38) { // Seta Cima
        if ((document.activeElement === prevBtn || document.activeElement === nextBtn) && linkBtn) {
          linkBtn.focus();
          e.preventDefault();
        } else if (document.activeElement === linkBtn && closeBtn) {
          closeBtn.focus();
          e.preventDefault();
        }
        return;
      }
      return;
    }

    // 5. NAVEGAÇÃO ESPACIAL NO PAINEL AMBIENTE (SEM MODAIS)
    if (!isModalOpen) {
      const switcherBtn = document.getElementById("wallpaper-switcher-btn");
      const settingsOpenBtn = document.getElementById("settings-open-btn");
      const zenBtn = document.getElementById("zen-mode-btn");
      const streamingCard = document.getElementById("streaming-card");
      const newsCard = document.getElementById("news-card");

      // No Nível 0 (Modo Zen Puro), setas horizontais navegam pelo wallpaper
      if (currentDisplayLevel === 0) {
        if (document.activeElement === zenBtn) {
          return;
        }
        if (e.keyCode === 39) { // Seta Direita -> Avançar Wallpaper
          cycleWallpaper(1);
          resetControlsHudTimer();
          e.preventDefault();
          return;
        }
        if (e.keyCode === 37) { // Seta Esquerda -> Voltar Wallpaper
          cycleWallpaper(-1);
          resetControlsHudTimer();
          e.preventDefault();
          return;
        }
        // Seta Cima, Baixo ou Enter -> Acorda o painel para Nível 2
        if (e.keyCode === 38 || e.keyCode === 40 || (e.keyCode === 13 && document.activeElement !== zenBtn)) {
          setDisplayLevel(2, true);
          if (newsCard) newsCard.focus();
          e.preventDefault();
          return;
        }
      }

      // No Nível 1 (Modo Relógio Adaptativo)
      if (currentDisplayLevel === 1) {
        // Seta Cima -> Invoca e foca no Menu do Dock
        if (e.keyCode === 38 && document.activeElement !== zenBtn && document.activeElement !== settingsOpenBtn && document.activeElement !== switcherBtn) {
          if (settingsOpenBtn) settingsOpenBtn.focus();
          resetControlsHudTimer();
          e.preventDefault();
          return;
        }
        // Se o dock não estiver focado, setas horizontais trocam de wallpaper
        if (document.activeElement !== zenBtn && document.activeElement !== settingsOpenBtn && document.activeElement !== switcherBtn) {
          if (e.keyCode === 39) {
            cycleWallpaper(1);
            resetControlsHudTimer();
            e.preventDefault();
            return;
          }
          if (e.keyCode === 37) {
            cycleWallpaper(-1);
            resetControlsHudTimer();
            e.preventDefault();
            return;
          }
        }
      }

      // Atalhos Rápidos de Teclado
      if (e.key === "z" || e.key === "Z" || e.key === "m" || e.key === "M") {
        cycleDisplayLevel();
        e.preventDefault();
        return;
      }
      if (e.key === "s" || e.key === "S" || e.key === "c" || e.key === "C") {
        openSettingsModal();
        e.preventDefault();
        return;
      }

      // Teclas de Canal / Mídia Samsung Smart TV
      // Channel Up (427), Media Next (10233), Fast Forward (417) -> Próximo Wallpaper
      if (e.keyCode === 427 || e.keyCode === 10233 || e.keyCode === 417) {
        cycleWallpaper(1);
        resetControlsHudTimer();
        e.preventDefault();
        return;
      }
      // Channel Down (428), Media Prev (10232), Rewind (412) -> Wallpaper Anterior
      if (e.keyCode === 428 || e.keyCode === 10232 || e.keyCode === 412) {
        cycleWallpaper(-1);
        resetControlsHudTimer();
        e.preventDefault();
        return;
      }

      // Tecla Espaço: Avança Wallpaper
      if (e.keyCode === 32) {
        cycleWallpaper(1);
        resetControlsHudTimer();
        e.preventDefault();
        return;
      }

      // Foco no Botão Zen (Modo de Exibição)
      if (document.activeElement === zenBtn) {
        if (e.keyCode === 39) { // Seta Direita -> Botão Menu / Settings
          if (settingsOpenBtn) settingsOpenBtn.focus();
          else if (switcherBtn) switcherBtn.focus();
          e.preventDefault();
          return;
        } else if (e.keyCode === 37) { // Seta Esquerda -> Volta wallpaper
          cycleWallpaper(-1);
          resetControlsHudTimer();
          e.preventDefault();
          return;
        } else if (e.keyCode === 40) { // Seta Baixo
          if (newsCard && currentDisplayLevel === 2) {
            newsCard.focus();
          } else {
            document.activeElement.blur();
            resetControlsHudTimer();
          }
          e.preventDefault();
          return;
        }
      }

      // Foco no Botão de Configurações (Menu)
      if (document.activeElement === settingsOpenBtn) {
        if (e.keyCode === 37) { // Seta Esquerda -> Botão Zen
          if (zenBtn) zenBtn.focus();
          e.preventDefault();
          return;
        } else if (e.keyCode === 39) { // Seta Direita -> Contador de Wallpaper
          if (switcherBtn) switcherBtn.focus();
          e.preventDefault();
          return;
        } else if (e.keyCode === 40) { // Seta Baixo
          if (streamingCard && currentDisplayLevel === 2) {
            streamingCard.focus();
          } else {
            document.activeElement.blur();
            resetControlsHudTimer();
          }
          e.preventDefault();
          return;
        }
      }

      // Foco no Botão de Wallpaper (Contador)
      if (document.activeElement === switcherBtn) {
        if (e.keyCode === 37) { // Seta Esquerda -> Botão Settings
          if (settingsOpenBtn) settingsOpenBtn.focus();
          else if (zenBtn) zenBtn.focus();
          e.preventDefault();
          return;
        } else if (e.keyCode === 39) { // Seta Direita -> Avança wallpaper
          cycleWallpaper(1);
          resetControlsHudTimer();
          e.preventDefault();
          return;
        } else if (e.keyCode === 40) { // Seta Baixo
          if (streamingCard && currentDisplayLevel === 2) {
            streamingCard.focus();
          } else {
            document.activeElement.blur();
            resetControlsHudTimer();
          }
          e.preventDefault();
          return;
        }
      }

      // Navegação Horizontal entre Cards e Controle Direcional do Wallpaper:
      if (e.keyCode === 39) { // Seta Direita -> Avançar
        if (document.activeElement === newsCard && streamingCard) {
          streamingCard.focus();
          e.preventDefault();
          return;
        }
        // Se já está no card mais à direita (streamingCard) ou em qualquer área neutra/painel, avança o wallpaper
        cycleWallpaper(1);
        resetControlsHudTimer();
        e.preventDefault();
        return;
      } else if (e.keyCode === 37) { // Seta Esquerda -> Voltar
        if (document.activeElement === streamingCard && newsCard) {
          newsCard.focus();
          e.preventDefault();
          return;
        }
        // Se já está no card mais à esquerda (newsCard) ou em qualquer área neutra/painel, volta o wallpaper
        cycleWallpaper(-1);
        resetControlsHudTimer();
        e.preventDefault();
        return;
      } else if (e.keyCode === 40) { // Seta Baixo
        if ((document.activeElement === switcherBtn || document.activeElement === settingsOpenBtn || document.activeElement === zenBtn) && newsCard) {
          newsCard.focus();
          e.preventDefault();
          return;
        } else if (document.activeElement !== newsCard && document.activeElement !== streamingCard) {
          if (newsCard) newsCard.focus();
          e.preventDefault();
          return;
        }
      } else if (e.keyCode === 38) { // Seta Cima
        if (document.activeElement === newsCard && zenBtn) {
          zenBtn.focus();
          e.preventDefault();
          return;
        } else if (document.activeElement === streamingCard) {
          if (settingsOpenBtn) settingsOpenBtn.focus();
          else if (switcherBtn) switcherBtn.focus();
          e.preventDefault();
          return;
        }
      }
    }
  });

  console.log("Ambient TV v0.9.18 pronto com navegação em notícias e relógio blocado.");
}

document.addEventListener("DOMContentLoaded", init);
