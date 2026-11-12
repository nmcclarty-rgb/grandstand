// Who won the Premier League each season, 1992/93 to 2025/26: one club per season, by the club codes in clubs.mjs.
// A player gets a TITLE for each season he made at least TITLE_APPS league appearances for the champions.
//
// Counts by club: Man Utd 13, Man City 8, Chelsea 5, Arsenal 4, Liverpool 2, Blackburn 1, Leicester 1 (34 seasons).
// 2025/26 (Arsenal) was checked against several published final tables; the season is complete in the exports (every club has 38 games of minutes).
export const CHAMPIONS = {
  '1992-93': 'MUN', '1993-94': 'MUN', '1994-95': 'BLA', '1995-96': 'MUN', '1996-97': 'MUN', '1997-98': 'ARS', '1998-99': 'MUN',
  '1999-00': 'MUN', '2000-01': 'MUN', '2001-02': 'ARS', '2002-03': 'MUN', '2003-04': 'ARS', '2004-05': 'CHE', '2005-06': 'CHE',
  '2006-07': 'MUN', '2007-08': 'MUN', '2008-09': 'MUN', '2009-10': 'CHE', '2010-11': 'MUN', '2011-12': 'MCI', '2012-13': 'MUN',
  '2013-14': 'MCI', '2014-15': 'CHE', '2015-16': 'LEI', '2016-17': 'CHE', '2017-18': 'MCI', '2018-19': 'MCI', '2019-20': 'LIV',
  '2020-21': 'MCI', '2021-22': 'MCI', '2022-23': 'MCI', '2023-24': 'MCI', '2024-25': 'LIV', '2025-26': 'ARS',
};
// the Premier League gives a winners' medal for 5 league appearances; we use the same line
export const TITLE_APPS = 5;
