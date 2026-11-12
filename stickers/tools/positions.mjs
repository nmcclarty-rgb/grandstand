// Position corrections. FBref gives a player a position per season, and for many it is two ("DF,MF"), listed in an order that is not
// reliable: Michael Essien and Nicky Butt are "DF,MF" in every season they played, so taking the first listed position made them
// defenders. 116 players with 100+ appearances were tagged defender from a "DF,MF" row; a classifier on goals, assists, cards and minutes
// (85% accurate on players with an unambiguous position) was used to find the candidates, and these are the ones that are clearly
// midfielders (central or defensive midfielders, wingers and wide midfielders), corrected by hand. Full-backs and centre-backs who are
// listed "DF,MF" (Carragher, Walker, Coleman, Azpilicueta, Ledley King...) stay defenders.
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
};
