// Position corrections. FBref gives a player a position per season, and for many it is two ("DF,MF"), listed in an order that is not
// reliable: Michael Essien and Nicky Butt are "DF,MF" in every season they played, so taking the first listed position made them
// defenders. 116 players with 100+ appearances were tagged defender from a "DF,MF" row; a classifier on goals, assists, cards and minutes
// (85% accurate on players with an unambiguous position) was used to find the candidates, and these are the ones that are clearly
// midfielders (central or defensive midfielders, wingers and wide midfielders), corrected by hand. Full-backs and centre-backs who are
// listed "DF,MF" (Carragher, Walker, Coleman, Azpilicueta, Ledley King...) stay defenders.
//
// The same for wingers: FBref's "FW,MF" is no more reliable, and a winger is a midfielder by Fantasy Premier League's convention. 122 players with 100+
// appearances were forwards only because of an "FW,MF" row; a classifier (94% accurate on players with an unambiguous position) ranked them and the wingers,
// wide forwards and playmakers were moved by hand. Salah and Kane, whom FBref lists as plain "FW", are untouched.
//
// Keyed by card id (name:birth year). build-cards.mjs refuses an override for a player who is not in the pool, or one that changes nothing.
export const POSITION_OVERRIDES = {
  // central and defensive midfielders
  'michael-essien:1982': 'MID', 'nicky-butt:1975': 'MID', 'james-milner:1986': 'MID', 'gilberto-silva:1976': 'MID', 'emmanuel-petit:1970': 'MID',
  'alexandre-song:1987': 'MID', 'jack-rodwell:1991': 'MID', 'fabian-delph:1989': 'MID', 'dean-whitehead:1982': 'MID', 'karl-henry:1982': 'MID',
  'jim-magilton:1969': 'MID', 'neil-maddison:1969': 'MID', 'chris-bart-williams:1974': 'MID', 'papa-bouba-diop:1978': 'MID', 'stefan-schwarz:1969': 'MID',
  'jonny-howson:1988': 'MID', 'bradley-johnson:1987': 'MID', 'valon-behrami:1985': 'MID', 'vurnon-anita:1989': 'MID', 'amdy-faye:1977': 'MID', 'geremi:1978': 'MID',
  // wingers and wide midfielders
  'andrei-kanchelskis:1969': 'MID', 'jesus-navas:1985': 'MID', 'ryan-taylor:1984': 'MID', 'matthew-taylor:1981': 'MID', 'matt-ritchie:1989': 'MID',
  'chris-brunt:1984': 'MID', 'kieran-richardson:1984': 'MID', 'stan-lazaridis:1972': 'MID', 'brett-emerton:1979': 'MID', 'steven-reid:1981': 'MID',
  'kevin-kilbane:1977': 'MID', 'ricardo-gardner:1978': 'MID',

  // wingers, wide forwards and attacking midfielders that FBref lists "FW,MF" (or "MF,FW"), moved from the forward pot to midfield, as Fantasy Premier League does.
  // (Strikers and second strikers stay forwards: Rooney, Welbeck, Yorke, Tevez, Aubameyang...)
  'seth-johnson:1979': 'MID', 'cesc-fabregas:1987': 'MID', 'david-ginola:1967': 'MID', 'stuart-ripley:1967': 'MID', 'chris-waddle:1960': 'MID',
  'vladimir-smicer:1973': 'MID', 'jesper-gr-nkj-r:1977': 'MID', 'luis-boa-morte:1977': 'MID', 'keith-gillespie:1975': 'MID',
  'graham-dorrans:1987': 'MID', 'jason-wilcox:1971': 'MID', 'stewart-downing:1984': 'MID', 'yannick-bolasie:1989': 'MID',
  'wayne-routledge:1985': 'MID', 'david-silva:1986': 'MID', 'el-hadji-diouf:1981': 'MID', 'laurent-robert:1975': 'MID',
  'morten-gamst-pedersen:1981': 'MID', 'jack-grealish:1995': 'MID', 'allan-saint-maximin:1997': 'MID', 'nani:1986': 'MID',
  'aaron-lennon:1987': 'MID', 'jerome-thomas:1983': 'MID', 'ryan-giggs:1973': 'MID', 'james-morrison:1986': 'MID', 'martin-petrov:1979': 'MID',
  'robert-snodgrass:1987': 'MID', 'george-boyd:1985': 'MID', 'shaun-wright-phillips:1981': 'MID', 'alan-smith:1980': 'MID',
  'stephen-hunt:1981': 'MID', 'samir-nasri:1987': 'MID', 'jacob-murphy:1995': 'MID', 'gavin-peacock:1967': 'MID', 'damien-duff:1979': 'MID',
  'lee-chung-yong:1988': 'MID', 'nick-barmby:1974': 'MID', 'victor-moses:1990': 'MID', 'paul-merson:1968': 'MID', 'graham-stuart:1970': 'MID',
  'stephane-sessegnon:1984': 'MID', 'jordan-ayew:1991': 'MID', 'oscar:1991': 'MID', 'junior-hoilett:1990': 'MID', 'nathan-dyer:1987': 'MID',
  'gerard-deulofeu:1994': 'MID', 'harry-kewell:1978': 'MID', 'anthony-gordon:2001': 'MID', 'wilfried-zaha:1992': 'MID', 'bukayo-saka:2001': 'MID',
  'brennan-johnson:2001': 'MID', 'freddie-ljungberg:1977': 'MID', 'marc-overmars:1973': 'MID', 'philippe-coutinho:1992': 'MID',
  'andrey-arshavin:1981': 'MID', 'leandro-trossard:1994': 'MID', 'eden-hazard:1991': 'MID', 'raheem-sterling:1994': 'MID',
  'riyad-mahrez:1991': 'MID', 'robert-pires:1973': 'MID', 'florent-malouda:1980': 'MID', 'gareth-bale:1989': 'MID', 'sadio-mane:1992': 'MID',
  'gabriel-martinelli:2001': 'MID', 'phil-foden:2000': 'MID', 'scott-sinclair:1989': 'MID', 'kevin-mirallas:1987': 'MID',
};
