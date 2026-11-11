// Club colours for the card faces: primary, secondary. Colours only, no crests or logos.
export const CLUB_COLOURS = {
  ARS: ['#EF0107', '#FFFFFF'], AVL: ['#670E36', '#95BFE5'], BHA: ['#0057B8', '#FFFFFF'], BOU: ['#DA291C', '#111111'],
  BRE: ['#E30613', '#FFFFFF'], BUR: ['#6C1D45', '#99D6EA'], CAR: ['#0070B5', '#D01217'], CHE: ['#034694', '#FFFFFF'],
  CRY: ['#1B458F', '#C4122E'], EVE: ['#003399', '#FFFFFF'], FUL: ['#222222', '#FFFFFF'], HUD: ['#0E63AD', '#FFFFFF'],
  HUL: ['#F5A12D', '#111111'], IPS: ['#3A64A3', '#FFFFFF'], LEE: ['#FFCD00', '#1D428A'], LEI: ['#003090', '#FDBE11'],
  LIV: ['#C8102E', '#F6EB61'], LUT: ['#F78F1E', '#002D62'], MCI: ['#6CABDD', '#FFFFFF'], MID: ['#E1202E', '#FFFFFF'],
  MUN: ['#DA291C', '#FBE122'], NEW: ['#241F20', '#FFFFFF'], NFO: ['#DD0000', '#FFFFFF'], NOR: ['#00A650', '#FFF200'],
  SHU: ['#EE2737', '#111111'], SOU: ['#D71920', '#FFFFFF'], STK: ['#E03A3E', '#FFFFFF'], SUN: ['#EB172B', '#FFFFFF'],
  SWA: ['#333333', '#FFFFFF'], TOT: ['#132257', '#FFFFFF'], WAT: ['#FBEE23', '#ED2127'], WBA: ['#122F67', '#FFFFFF'],
  WHU: ['#7A263A', '#1BB1E7'], WOL: ['#FDB913', '#231F20'],
  BAR: ['#D81920', '#FFFFFF'], BIR: ['#1D3DBF', '#FFFFFF'], BLA: ['#0069B4', '#FFFFFF'], BLP: ['#F68712', '#FFFFFF'],
  BOL: ['#263C7E', '#FFFFFF'], BRA: ['#7A1F2B', '#F2B705'], CHA: ['#D4021D', '#FFFFFF'], COV: ['#59CBE8', '#FFFFFF'],
  DER: ['#E8E8E8', '#111111'], OLD: ['#0033A0', '#FFFFFF'], POR: ['#001489', '#FFFFFF'], QPR: ['#1D5BA4', '#FFFFFF'],
  REA: ['#004494', '#FFFFFF'], SHW: ['#0E4C92', '#FFFFFF'], SWI: ['#E4002B', '#FFFFFF'], WIG: ['#1D59AF', '#FFFFFF'],
  WIM: ['#0A2A6B', '#F2D200'],
};

// black or white, whichever reads on this background
export function inkOn(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#14181c' : '#ffffff';
}
