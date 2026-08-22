export interface TeamItem {
  name: string;
  code: string;
  emoji: string;
  category: string;
}

export interface RivalryPreset {
  name: string;
  team1: TeamItem;
  team2: TeamItem;
  label: string;
  hours: number;
}

export const TEAMS_LIST: TeamItem[] = [
  // === 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND ===
  { name: 'Arsenal', code: 'ARS', emoji: '🔴', category: 'England (Big Clubs)' },
  { name: 'Liverpool', code: 'LIV', emoji: '🔴', category: 'England (Big Clubs)' },
  { name: 'Manchester City', code: 'MCI', emoji: '🔵', category: 'England (Big Clubs)' },
  { name: 'Manchester United', code: 'MUN', emoji: '🔴', category: 'England (Big Clubs)' },
  { name: 'Chelsea', code: 'CHE', emoji: '🔵', category: 'England (Big Clubs)' },
  { name: 'Tottenham Hotspur', code: 'TOT', emoji: '⚪', category: 'England (Big Clubs)' },
  { name: 'Newcastle United', code: 'NEW', emoji: '⚫⚪', category: 'England (Big Clubs)' },
  { name: 'Aston Villa', code: 'AVL', emoji: '🍇🔵', category: 'England (Big Clubs)' },

  { name: 'Everton', code: 'EVE', emoji: '🔵', category: 'England (Other Popular)' },
  { name: 'West Ham United', code: 'WHU', emoji: '🍷🔵', category: 'England (Other Popular)' },
  { name: 'Brighton', code: 'BHA', emoji: '🔵⚪', category: 'England (Other Popular)' },
  { name: 'Crystal Palace', code: 'CRY', emoji: '🔴🔵', category: 'England (Other Popular)' },
  { name: 'Nottingham Forest', code: 'NFO', emoji: '🔴', category: 'England (Other Popular)' },
  { name: 'Brentford', code: 'BRE', emoji: '🔴⚪', category: 'England (Other Popular)' },
  { name: 'Fulham', code: 'FUL', emoji: '⚪⚫', category: 'England (Other Popular)' },
  { name: 'Wolves', code: 'WOL', emoji: '🟡⚫', category: 'England (Other Popular)' },
  { name: 'Bournemouth', code: 'BOU', emoji: '🔴⚫', category: 'England (Other Popular)' },
  { name: 'Burnley', code: 'BUR', emoji: '🍷', category: 'England (Other Popular)' },
  { name: 'Leeds United', code: 'LEE', emoji: '⚪', category: 'England (Other Popular)' },
  { name: 'Sunderland', code: 'SUN', emoji: '🔴⚪', category: 'England (Other Popular)' },
  { name: 'Leicester City', code: 'LEI', emoji: '🔵', category: 'England (Other Popular)' },

  // === 🇪🇸 SPAIN ===
  { name: 'Real Madrid', code: 'RMA', emoji: '⚪', category: 'Spain (Big Clubs)' },
  { name: 'Barcelona', code: 'BAR', emoji: '🔴🔵', category: 'Spain (Big Clubs)' },
  { name: 'Atlético Madrid', code: 'ATM', emoji: '🔴⚪', category: 'Spain (Big Clubs)' },

  { name: 'Athletic Club', code: 'ATH', emoji: '🔴⚪', category: 'Spain (Other Popular)' },
  { name: 'Real Sociedad', code: 'RSO', emoji: '🔵⚪', category: 'Spain (Other Popular)' },
  { name: 'Sevilla', code: 'SEV', emoji: '⚪🔴', category: 'Spain (Other Popular)' },
  { name: 'Valencia', code: 'VAL', emoji: '⚪⚫', category: 'Spain (Other Popular)' },
  { name: 'Villarreal', code: 'VIL', emoji: '🟡', category: 'Spain (Other Popular)' },
  { name: 'Real Betis', code: 'BET', emoji: '🟢⚪', category: 'Spain (Other Popular)' },
  { name: 'Girona', code: 'GIR', emoji: '🔴⚪', category: 'Spain (Other Popular)' },
  { name: 'Celta Vigo', code: 'CEL', emoji: '🔵⚪', category: 'Spain (Other Popular)' },
  { name: 'Osasuna', code: 'OSA', emoji: '🔴', category: 'Spain (Other Popular)' },
  { name: 'Espanyol', code: 'ESP', emoji: '🔵⚪', category: 'Spain (Other Popular)' },
  { name: 'Mallorca', code: 'MAL', emoji: '🔴', category: 'Spain (Other Popular)' },
  { name: 'Getafe', code: 'GET', emoji: '🔵', category: 'Spain (Other Popular)' },
  { name: 'Rayo Vallecano', code: 'RAY', emoji: '⚪🔴', category: 'Spain (Other Popular)' },
  { name: 'Las Palmas', code: 'LPA', emoji: '🟡🔵', category: 'Spain (Other Popular)' },

  // === 🇮🇹 ITALY ===
  { name: 'Inter Milan', code: 'INT', emoji: '🔵⚫', category: 'Italy (Big Clubs)' },
  { name: 'AC Milan', code: 'ACM', emoji: '🔴⚫', category: 'Italy (Big Clubs)' },
  { name: 'Juventus', code: 'JUV', emoji: '⚫⚪', category: 'Italy (Big Clubs)' },
  { name: 'Napoli', code: 'NAP', emoji: '🔵', category: 'Italy (Big Clubs)' },
  { name: 'Roma', code: 'ROM', emoji: '🍷🟡', category: 'Italy (Big Clubs)' },
  { name: 'Lazio', code: 'LAZ', emoji: '🦅🔵', category: 'Italy (Big Clubs)' },
  { name: 'Atalanta', code: 'ATA', emoji: '🔵⚫', category: 'Italy (Big Clubs)' },

  { name: 'Fiorentina', code: 'FIO', emoji: '🟣', category: 'Italy (Other Clubs)' },
  { name: 'Bologna', code: 'BOL', emoji: '🔴🔵', category: 'Italy (Other Clubs)' },
  { name: 'Torino', code: 'TOR', emoji: '🍷', category: 'Italy (Other Clubs)' },
  { name: 'Udinese', code: 'UDI', emoji: '⚫⚪', category: 'Italy (Other Clubs)' },
  { name: 'Genoa', code: 'GEN', emoji: '🔴🔵', category: 'Italy (Other Clubs)' },
  { name: 'Parma', code: 'PAR', emoji: '🟡🔵', category: 'Italy (Other Clubs)' },
  { name: 'Como', code: 'COM', emoji: '🔵', category: 'Italy (Other Clubs)' },
  { name: 'Lecce', code: 'LEC', emoji: '🟡🔴', category: 'Italy (Other Clubs)' },
  { name: 'Cagliari', code: 'CAG', emoji: '🔴🔵', category: 'Italy (Other Clubs)' },
  { name: 'Monza', code: 'MON', emoji: '🔴', category: 'Italy (Other Clubs)' },
  { name: 'Verona', code: 'VER', emoji: '🟡🔵', category: 'Italy (Other Clubs)' },
  { name: 'Empoli', code: 'EMP', emoji: '🔵', category: 'Italy (Other Clubs)' },
  { name: 'Sassuolo', code: 'SAS', emoji: '🟢⚫', category: 'Italy (Other Clubs)' },

  // === 🇩🇪 GERMANY ===
  { name: 'Bayern Munich', code: 'FCB', emoji: '🔴', category: 'Germany (Big Clubs)' },
  { name: 'Borussia Dortmund', code: 'BVB', emoji: '🟡⚫', category: 'Germany (Big Clubs)' },
  { name: 'Bayer Leverkusen', code: 'LEV', emoji: '🔴⚫', category: 'Germany (Big Clubs)' },
  { name: 'RB Leipzig', code: 'RBL', emoji: '⚪🔴', category: 'Germany (Big Clubs)' },

  { name: 'Eintracht Frankfurt', code: 'SGE', emoji: '🔴⚫', category: 'Germany (Other Clubs)' },
  { name: 'Stuttgart', code: 'VFB', emoji: '⚪🔴', category: 'Germany (Other Clubs)' },
  { name: 'Wolfsburg', code: 'WOB', emoji: '🟢', category: 'Germany (Other Clubs)' },
  { name: 'Borussia Mönchengladbach', code: 'BMG', emoji: '🟢⚫', category: 'Germany (Other Clubs)' },
  { name: 'Freiburg', code: 'SCF', emoji: '🔴⚪', category: 'Germany (Other Clubs)' },
  { name: 'Hoffenheim', code: 'TSG', emoji: '🔵', category: 'Germany (Other Clubs)' },
  { name: 'Mainz', code: 'M05', emoji: '🔴', category: 'Germany (Other Clubs)' },
  { name: 'Union Berlin', code: 'FCU', emoji: '🔴⚪', category: 'Germany (Other Clubs)' },
  { name: 'Werder Bremen', code: 'SVW', emoji: '🟢⚪', category: 'Germany (Other Clubs)' },
  { name: 'Köln', code: 'KOE', emoji: '🔴⚪', category: 'Germany (Other Clubs)' },
  { name: 'Hamburg', code: 'HSV', emoji: '🔵⚪', category: 'Germany (Other Clubs)' },

  // === 🇫🇷 FRANCE ===
  { name: 'Paris Saint-Germain', code: 'PSG', emoji: '🔵🔴', category: 'France (Big Clubs)' },
  { name: 'Marseille', code: 'OM', emoji: '🔵⚪', category: 'France (Big Clubs)' },
  { name: 'Monaco', code: 'ASM', emoji: '🔴⚪', category: 'France (Big Clubs)' },
  { name: 'Lyon', code: 'OL', emoji: '⚪🔵', category: 'France (Big Clubs)' },
  { name: 'Lille', code: 'LOSC', emoji: '🔴🔵', category: 'France (Big Clubs)' },

  { name: 'Nice', code: 'NIC', emoji: '🔴⚫', category: 'France (Other Clubs)' },
  { name: 'Lens', code: 'RCL', emoji: '🔴🟡', category: 'France (Other Clubs)' },
  { name: 'Rennes', code: 'SRFC', emoji: '🔴⚫', category: 'France (Other Clubs)' },
  { name: 'Strasbourg', code: 'RCSA', emoji: '🔵', category: 'France (Other Clubs)' },
  { name: 'Nantes', code: 'FCN', emoji: '🟡🟢', category: 'France (Other Clubs)' },
  { name: 'Montpellier', code: 'MHSC', emoji: '🔵🟡', category: 'France (Other Clubs)' },
  { name: 'Toulouse', code: 'TFC', emoji: '🟣⚪', category: 'France (Other Clubs)' },
  { name: 'Brest', code: 'SB29', emoji: '🔴', category: 'France (Other Clubs)' },
  { name: 'Reims', code: 'SDR', emoji: '🔴⚪', category: 'France (Other Clubs)' },
  { name: 'Auxerre', code: 'AJA', emoji: '⚪🔵', category: 'France (Other Clubs)' },
  { name: 'Metz', code: 'FCM', emoji: '🍷', category: 'France (Other Clubs)' },

  // === 🇳🇱 NETHERLANDS ===
  { name: 'Ajax', code: 'AJA', emoji: '🔴⚪', category: 'Netherlands (Eredivisie)' },
  { name: 'PSV Eindhoven', code: 'PSV', emoji: '🔴⚪', category: 'Netherlands (Eredivisie)' },
  { name: 'Feyenoord', code: 'FEY', emoji: '🔴⚪', category: 'Netherlands (Eredivisie)' },
  { name: 'AZ Alkmaar', code: 'AZ', emoji: '🔴', category: 'Netherlands (Eredivisie)' },
  { name: 'FC Twente', code: 'TWE', emoji: '🔴', category: 'Netherlands (Eredivisie)' },
  { name: 'Utrecht', code: 'UTR', emoji: '🔴⚪', category: 'Netherlands (Eredivisie)' },

  // === 🇵🇹 PORTUGAL ===
  { name: 'Benfica', code: 'BEN', emoji: '🔴🦅', category: 'Portugal (Primeira Liga)' },
  { name: 'Porto', code: 'POR', emoji: '🔵⚪', category: 'Portugal (Primeira Liga)' },
  { name: 'Sporting CP', code: 'SCP', emoji: '🟢⚪', category: 'Portugal (Primeira Liga)' },
  { name: 'Braga', code: 'SCB', emoji: '🔴⚪', category: 'Portugal (Primeira Liga)' },
  { name: 'Vitória Guimarães', code: 'VSC', emoji: '⚪⚫', category: 'Portugal (Primeira Liga)' },

  // === 🇧🇪 BELGIUM ===
  { name: 'Club Brugge', code: 'CLU', emoji: '🔵⚫', category: 'Belgium (Pro League)' },
  { name: 'Anderlecht', code: 'AND', emoji: '🟣⚪', category: 'Belgium (Pro League)' },
  { name: 'Genk', code: 'GNK', emoji: '🔵⚪', category: 'Belgium (Pro League)' },
  { name: 'Gent', code: 'GNT', emoji: '🔵⚪', category: 'Belgium (Pro League)' },
  { name: 'Antwerp', code: 'ANT', emoji: '🔴⚪', category: 'Belgium (Pro League)' },
  { name: 'Union Saint-Gilloise', code: 'USG', emoji: '🟡🔵', category: 'Belgium (Pro League)' },

  // === 🇹🇷 TURKEY ===
  { name: 'Galatasaray', code: 'GAL', emoji: '🔴🟡', category: 'Turkey (Süper Lig)' },
  { name: 'Fenerbahçe', code: 'FEN', emoji: '🟡🔵', category: 'Turkey (Süper Lig)' },
  { name: 'Beşiktaş', code: 'BES', emoji: '⚫⚪', category: 'Turkey (Süper Lig)' },
  { name: 'Trabzonspor', code: 'TRA', emoji: '🍷🔵', category: 'Turkey (Süper Lig)' },

  // === 🇸🇦 SAUDI ARABIA ===
  { name: 'Al Hilal', code: 'HIL', emoji: '🔵', category: 'Saudi Pro League' },
  { name: 'Al Nassr', code: 'NAS', emoji: '🟡🔵', category: 'Saudi Pro League' },
  { name: 'Al Ahli', code: 'AHL', emoji: '🟢⚪', category: 'Saudi Pro League' },
  { name: 'Al Ittihad', code: 'ITT', emoji: '🟡⚫', category: 'Saudi Pro League' },
  { name: 'Al Ettifaq', code: 'ETT', emoji: '🟢🔴', category: 'Saudi Pro League' },
  { name: 'Al Shabab', code: 'SHA', emoji: '⚫⚪', category: 'Saudi Pro League' },

  // === 🇺🇸 USA ===
  { name: 'Inter Miami', code: 'MIA', emoji: '💗⚫', category: 'Major League Soccer (MLS)' },
  { name: 'LA Galaxy', code: 'LAG', emoji: '⚪🟡', category: 'Major League Soccer (MLS)' },
  { name: 'Los Angeles FC', code: 'LAF', emoji: '⚫🟡', category: 'Major League Soccer (MLS)' },
  { name: 'Seattle Sounders', code: 'SEA', emoji: '🟢🔵', category: 'Major League Soccer (MLS)' },
  { name: 'Atlanta United', code: 'ATL', emoji: '🔴⚫', category: 'Major League Soccer (MLS)' },
  { name: 'New York City FC', code: 'NYC', emoji: '🔵⚪', category: 'Major League Soccer (MLS)' },
  { name: 'Columbus Crew', code: 'CLB', emoji: '🟡⚫', category: 'Major League Soccer (MLS)' },
  { name: 'FC Cincinnati', code: 'CIN', emoji: '🔵🟠', category: 'Major League Soccer (MLS)' },

  // === 🇧🇷 BRAZIL ===
  { name: 'Flamengo', code: 'FLA', emoji: '🔴⚫', category: 'Brazil (Brasileirão)' },
  { name: 'Palmeiras', code: 'PAL', emoji: '🟢', category: 'Brazil (Brasileirão)' },
  { name: 'Corinthians', code: 'COR', emoji: '⚫⚪', category: 'Brazil (Brasileirão)' },
  { name: 'São Paulo', code: 'SAO', emoji: '🔴⚪⚫', category: 'Brazil (Brasileirão)' },
  { name: 'Santos', code: 'SAN', emoji: '⚪', category: 'Brazil (Brasileirão)' },
  { name: 'Fluminense', code: 'FLU', emoji: '🍷🟢⚪', category: 'Brazil (Brasileirão)' },
  { name: 'Botafogo', code: 'BOT', emoji: '⚫⚪', category: 'Brazil (Brasileirão)' },
  { name: 'Internacional', code: 'INT', emoji: '🔴', category: 'Brazil (Brasileirão)' },
  { name: 'Grêmio', code: 'GRE', emoji: '🔵⚫⚪', category: 'Brazil (Brasileirão)' },
  { name: 'Atlético Mineiro', code: 'CAM', emoji: '⚫⚪', category: 'Brazil (Brasileirão)' },

  // === 🇦🇷 ARGENTINA ===
  { name: 'River Plate', code: 'RIV', emoji: '⚪🔴', category: 'Argentina (Primera)' },
  { name: 'Boca Juniors', code: 'BOC', emoji: '🔵🟡', category: 'Argentina (Primera)' },
  { name: 'Racing Club', code: 'RAC', emoji: '🔵⚪', category: 'Argentina (Primera)' },
  { name: 'Independiente', code: 'IND', emoji: '🔴', category: 'Argentina (Primera)' },
  { name: 'San Lorenzo', code: 'SLO', emoji: '🔴🔵', category: 'Argentina (Primera)' },
  { name: 'Vélez Sarsfield', code: 'VEL', emoji: '⚪🔵', category: 'Argentina (Primera)' },

  // === 🏆 DOMESTIC CUPS ===
  { name: 'FA Cup', code: 'FAC', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'EFL Cup', code: 'EFL', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Community Shield', code: 'COM', emoji: '🛡️', category: 'Domestic Cups' },
  { name: 'Copa del Rey', code: 'CDR', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Supercopa de España', code: 'SDE', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Coppa Italia', code: 'COP', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Supercoppa Italiana', code: 'SCI', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'DFB-Pokal', code: 'DFB', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'DFL Super Cup', code: 'DFL', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Coupe de France', code: 'CDF', emoji: '🏆', category: 'Domestic Cups' },
  { name: 'Trophée des Champions', code: 'TDC', emoji: '🏆', category: 'Domestic Cups' },

  // === 🌍 NATIONAL TEAMS ===
  // Europe
  { name: 'England', code: 'ENG', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'National Teams (Europe)' },
  { name: 'Spain', code: 'ESP', emoji: '🇪🇸', category: 'National Teams (Europe)' },
  { name: 'France', code: 'FRA', emoji: '🇫🇷', category: 'National Teams (Europe)' },
  { name: 'Germany', code: 'GER', emoji: '🇩🇪', category: 'National Teams (Europe)' },
  { name: 'Italy', code: 'ITA', emoji: '🇮🇹', category: 'National Teams (Europe)' },
  { name: 'Portugal', code: 'POR', emoji: '🇵🇹', category: 'National Teams (Europe)' },
  { name: 'Netherlands', code: 'NED', emoji: '🇳🇱', category: 'National Teams (Europe)' },
  { name: 'Belgium', code: 'BEL', emoji: '🇧🇪', category: 'National Teams (Europe)' },
  { name: 'Croatia', code: 'CRO', emoji: '🇭🇷', category: 'National Teams (Europe)' },
  { name: 'Switzerland', code: 'SUI', emoji: '🇨🇭', category: 'National Teams (Europe)' },
  { name: 'Denmark', code: 'DEN', emoji: '🇩🇰', category: 'National Teams (Europe)' },
  // South America
  { name: 'Argentina', code: 'ARG', emoji: '🇦🇷', category: 'National Teams (South America)' },
  { name: 'Brazil', code: 'BRA', emoji: '🇧🇷', category: 'National Teams (South America)' },
  { name: 'Uruguay', code: 'URU', emoji: '🇺🇾', category: 'National Teams (South America)' },
  { name: 'Colombia', code: 'COL', emoji: '🇨🇴', category: 'National Teams (South America)' },
  { name: 'Chile', code: 'CHI', emoji: '🇨🇱', category: 'National Teams (South America)' },
  { name: 'Ecuador', code: 'ECU', emoji: '🇪🇨', category: 'National Teams (South America)' },
  // Asia
  { name: 'Japan', code: 'JPN', emoji: '🇯🇵', category: 'National Teams (Asia)' },
  { name: 'South Korea', code: 'KOR', emoji: '🇰🇷', category: 'National Teams (Asia)' },
  { name: 'Saudi Arabia', code: 'KSA', emoji: '🇸🇦', category: 'National Teams (Asia)' },
  { name: 'Iran', code: 'IRN', emoji: '🇮🇷', category: 'National Teams (Asia)' },
  { name: 'Australia', code: 'AUS', emoji: '🇦🇺', category: 'National Teams (Asia)' },
  { name: 'Qatar', code: 'QAT', emoji: '🇶🇦', category: 'National Teams (Asia)' },
  // Africa
  { name: 'Morocco', code: 'MAR', emoji: '🇲🇦', category: 'National Teams (Africa)' },
  { name: 'Egypt', code: 'EGY', emoji: '🇪🇬', category: 'National Teams (Africa)' },
  { name: 'Senegal', code: 'SEN', emoji: '🇸🇳', category: 'National Teams (Africa)' },
  { name: 'Nigeria', code: 'NGA', emoji: '🇳🇬', category: 'National Teams (Africa)' },
  { name: 'Algeria', code: 'ALG', emoji: '🇩🇿', category: 'National Teams (Africa)' },
  { name: 'Ivory Coast', code: 'CIV', emoji: '🇨🇮', category: 'National Teams (Africa)' },
  { name: 'Ghana', code: 'GHA', emoji: '🇬🇭', category: 'National Teams (Africa)' },
  { name: 'Tunisia', code: 'TUN', emoji: '🇹🇳', category: 'National Teams (Africa)' },
  // North America
  { name: 'USA', code: 'USA', emoji: '🇺🇸', category: 'National Teams (North America)' },
  { name: 'Mexico', code: 'MEX', emoji: '🇲🇽', category: 'National Teams (North America)' },
  { name: 'Canada', code: 'CAN', emoji: '🇨🇦', category: 'National Teams (North America)' },
  { name: 'Costa Rica', code: 'CRC', emoji: '🇨🇨', category: 'National Teams (North America)' },
];

export const RIVALRY_PRESETS: RivalryPreset[] = [
  {
    name: 'Liverpool vs Manchester United',
    team1: { name: 'Liverpool', code: 'LIV', emoji: '🔴', category: 'England (Big Clubs)' },
    team2: { name: 'Manchester United', code: 'MUN', emoji: '🔴', category: 'England (Big Clubs)' },
    label: 'NORTH WEST DERBY',
    hours: 48
  },
  {
    name: 'Liverpool vs Arsenal',
    team1: { name: 'Liverpool', code: 'LIV', emoji: '🔴', category: 'England (Big Clubs)' },
    team2: { name: 'Arsenal', code: 'ARS', emoji: '🔴', category: 'England (Big Clubs)' },
    label: 'PREMIER LEAGUE',
    hours: 36
  },
  {
    name: 'Arsenal vs Chelsea',
    team1: { name: 'Arsenal', code: 'ARS', emoji: '🔴', category: 'England (Big Clubs)' },
    team2: { name: 'Chelsea', code: 'CHE', emoji: '🔵', category: 'England (Big Clubs)' },
    label: 'LONDON DERBY',
    hours: 72
  },
  {
    name: 'Chelsea vs Tottenham',
    team1: { name: 'Chelsea', code: 'CHE', emoji: '🔵', category: 'England (Big Clubs)' },
    team2: { name: 'Tottenham Hotspur', code: 'TOT', emoji: '⚪', category: 'England (Big Clubs)' },
    label: 'LONDON DERBY',
    hours: 48
  },
  {
    name: 'Manchester City vs Manchester United',
    team1: { name: 'Manchester City', code: 'MCI', emoji: '🔵', category: 'England (Big Clubs)' },
    team2: { name: 'Manchester United', code: 'MUN', emoji: '🔴', category: 'England (Big Clubs)' },
    label: 'MANCHESTER DERBY',
    hours: 36
  },
  {
    name: 'Manchester City vs Liverpool',
    team1: { name: 'Manchester City', code: 'MCI', emoji: '🔵', category: 'England (Big Clubs)' },
    team2: { name: 'Liverpool', code: 'LIV', emoji: '🔴', category: 'England (Big Clubs)' },
    label: 'TITLE DECIDER',
    hours: 12
  },
  {
    name: 'Newcastle vs Sunderland',
    team1: { name: 'Newcastle United', code: 'NEW', emoji: '⚫⚪', category: 'England (Big Clubs)' },
    team2: { name: 'Sunderland', code: 'SUN', emoji: '🔴⚪', category: 'England (Other Popular)' },
    label: 'TYNE-WEAR DERBY',
    hours: 72
  },
  {
    name: 'Everton vs Liverpool',
    team1: { name: 'Everton', code: 'EVE', emoji: '🔵', category: 'England (Other Popular)' },
    team2: { name: 'Liverpool', code: 'LIV', emoji: '🔴', category: 'England (Big Clubs)' },
    label: 'MERSEYSIDE DERBY',
    hours: 48
  },
  {
    name: 'Barcelona vs Real Madrid (El Clásico)',
    team1: { name: 'Barcelona', code: 'BAR', emoji: '🔴🔵', category: 'Spain (Big Clubs)' },
    team2: { name: 'Real Madrid', code: 'RMA', emoji: '⚪', category: 'Spain (Big Clubs)' },
    label: 'EL CLÁSICO',
    hours: 36
  },
  {
    name: 'Atlético Madrid vs Real Madrid',
    team1: { name: 'Atlético Madrid', code: 'ATM', emoji: '🔴⚪', category: 'Spain (Big Clubs)' },
    team2: { name: 'Real Madrid', code: 'RMA', emoji: '⚪', category: 'Spain (Big Clubs)' },
    label: 'MADRID DERBY',
    hours: 48
  },
  {
    name: 'Barcelona vs Atlético Madrid',
    team1: { name: 'Barcelona', code: 'BAR', emoji: '🔴🔵', category: 'Spain (Big Clubs)' },
    team2: { name: 'Atlético Madrid', code: 'ATM', emoji: '🔴⚪', category: 'Spain (Big Clubs)' },
    label: 'LA LIGA SHOWDOWN',
    hours: 72
  },
  {
    name: 'AC Milan vs Inter Milan',
    team1: { name: 'AC Milan', code: 'ACM', emoji: '🔴⚫', category: 'Italy (Big Clubs)' },
    team2: { name: 'Inter Milan', code: 'INT', emoji: '🔵⚫', category: 'Italy (Big Clubs)' },
    label: 'DERBY DELLA MADONNINA',
    hours: 36
  },
  {
    name: 'Juventus vs Inter Milan (Derby d\'Italia)',
    team1: { name: 'Juventus', code: 'JUV', emoji: '⚫⚪', category: 'Italy (Big Clubs)' },
    team2: { name: 'Inter Milan', code: 'INT', emoji: '🔵⚫', category: 'Italy (Big Clubs)' },
    label: 'DERBY D\'ITALIA',
    hours: 48
  },
  {
    name: 'Roma vs Lazio',
    team1: { name: 'Roma', code: 'ROM', emoji: '🍷🟡', category: 'Italy (Big Clubs)' },
    team2: { name: 'Lazio', code: 'LAZ', emoji: '🦅🔵', category: 'Italy (Big Clubs)' },
    label: 'DERBY DELLA CAPITALE',
    hours: 72
  },
  {
    name: 'Bayern Munich vs Borussia Dortmund (Le Klassiker)',
    team1: { name: 'Bayern Munich', code: 'FCB', emoji: '🔴', category: 'Germany (Big Clubs)' },
    team2: { name: 'Borussia Dortmund', code: 'BVB', emoji: '🟡⚫', category: 'Germany (Big Clubs)' },
    label: 'DER KLASSIKER',
    hours: 36
  },
  {
    name: 'PSG vs Marseille (Le Classique)',
    team1: { name: 'Paris Saint-Germain', code: 'PSG', emoji: '🔵🔴', category: 'France (Big Clubs)' },
    team2: { name: 'Marseille', code: 'OM', emoji: '🔵⚪', category: 'France (Big Clubs)' },
    label: 'LE CLASSIQUE',
    hours: 48
  },
  {
    name: 'Benfica vs Porto',
    team1: { name: 'Benfica', code: 'BEN', emoji: '🔴🦅', category: 'Portugal (Primeira Liga)' },
    team2: { name: 'Porto', code: 'POR', emoji: '🔵⚪', category: 'Portugal (Primeira Liga)' },
    label: 'O CLÁSSICO',
    hours: 72
  },
  {
    name: 'Galatasaray vs Fenerbahçe',
    team1: { name: 'Galatasaray', code: 'GAL', emoji: '🔴🟡', category: 'Turkey (Süper Lig)' },
    team2: { name: 'Fenerbahçe', code: 'FEN', emoji: '🟡🔵', category: 'Turkey (Süper Lig)' },
    label: 'KITALARARASI DERBİ',
    hours: 36
  },
  {
    name: 'Boca Juniors vs River Plate (Superclásico)',
    team1: { name: 'Boca Juniors', code: 'BOC', emoji: '🔵🟡', category: 'Argentina (Primera)' },
    team2: { name: 'River Plate', code: 'RIV', emoji: '⚪🔴', category: 'Argentina (Primera)' },
    label: 'SUPERCLÁSICO',
    hours: 48
  },
];
