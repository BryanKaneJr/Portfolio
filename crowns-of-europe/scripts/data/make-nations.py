# One-off authoring helper: writes src/content/nations.json and scenario1444.json from the compact table below.
# Edit the JSON directly from now on (this file is kept as a record of the first pass).
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

# id, name, adjective, color, faith, capital, gov, personality, trait, tier, difficulty, flag(pattern, colors...), desc
N = [
 ('FRA','France','French','#3a63b5','catholic','ile_de_france','monarchy','expansionist','gendarmes','major','easy',('lis','#2a4c9c','#e8c547'),
  'The largest kingdom in Christendom, battered by a century of war with England. Drive the English out and gather the great fiefs under the crown.'),
 ('ENG','England','English','#c0392b','catholic','london','monarchy','opportunist','longbowmen','major','normal',('cross','#f4f1e6','#c0392b'),
  'Still holding Normandy, Gascony and Calais, but the Hundred Years’ War is turning. Hold the continent, or turn to the sea.'),
 ('CAS','Castile','Castilian','#e0b23a','catholic','castile','monarchy','expansionist','reconquista','major','easy',('quarterly','#c0392b','#e8c547'),
  'The heart of Iberia. Finish the Reconquista by taking Granada, then look across the strait and the sea.'),
 ('ARA','Aragon','Aragonese','#e07b39','catholic','aragon','monarchy','opportunist','crown_of_aragon','major','normal',('pales','#e8c547','#b8322a'),
  'A Mediterranean crown spanning Catalonia, Valencia, Sicily and Sardinia. Rule the western sea and dream of Naples.'),
 ('POR','Portugal','Portuguese','#2d7a4c','catholic','lisbon','monarchy','trader','navigators','major','normal',('border','#f4f1e6','#b8322a'),
  'A small kingdom with its back to the ocean. Grow rich on the sea and carve a foothold in Morocco. A good first campaign.'),
 ('BUR','Burgundy','Burgundian','#8b5ca8','catholic','burgundy','monarchy','opportunist','golden_fleece','major','normal',('bendy','#e8c547','#2a4c9c'),
  'The richest duchy in Europe, stitched together from Flanders to the Jura. Unite your lands and become a kingdom in your own right.'),
 ('HAB','Austria','Austrian','#ece4cf','catholic','austria','monarchy','defensive','aeiou','major','normal',('fess','#c0392b','#f4f1e6'),
  'Habsburg archdukes and Holy Roman Emperors. Few lands, great ambitions: marry well and inherit Europe.'),
 ('BOH','Bohemia','Bohemian','#c79b5b','catholic','bohemia','monarchy','defensive','hussite_wagons','major','normal',('charge','#c0392b','#f4f1e6','lion'),
  'An elector of the Empire with rich mines and a stubborn Hussite army. Survive your neighbours and claim the imperial crown.'),
 ('HUN','Hungary','Hungarian','#94a83f','catholic','hungary','monarchy','opportunist','bulwark','major','normal',('barry','#c0392b','#f4f1e6'),
  'The shield of Christendom against the Ottomans. Hold the Danube, and the Balkans may follow.'),
 ('POL','Poland','Polish','#b8336a','catholic','lesser_poland','monarchy','opportunist','szlachta','major','normal',('charge','#c0392b','#f4f1e6','eagle'),
  'A great kingdom in mourning after Varna. Unite with Lithuania and break the Teutonic Order.'),
 ('LIT','Lithuania','Lithuanian','#4fb3a0','catholic','lithuania','monarchy','expansionist','grand_duchy','major','normal',('charge','#a8322a','#f4f1e6','rider'),
  'The largest state in Europe, stretching from the Baltic to the steppe. Hold your Ruthenian lands against Muscovy.'),
 ('MOS','Muscovy','Muscovite','#3f8f3a','orthodox','moscow','monarchy','expansionist','third_rome','major','normal',('charge','#a8322a','#e8c547','rider'),
  'A rising principality among many Russian states. Gather the Russian lands: Tver, Ryazan, and great Novgorod.'),
 ('TUR','Ottomans','Ottoman','#2a8c87','muslim','rumelia','monarchy','expansionist','ghazi','major','easy',('crescent','#b8322a','#f4f1e6'),
  'A young empire on both sides of the straits. Constantinople stands alone between your halves. Take it.'),
 ('VEN','Venice','Venetian','#2e7ea6','catholic','veneto','republic','trader','merchant_republic','major','normal',('charge','#a8322a','#e8c547','lion'),
  'The Most Serene Republic, mistress of the Adriatic. Trade, scheme, and keep your sea lanes open.'),
 ('SCO','Scotland','Scottish','#6d7fd1','catholic','lowlands','monarchy','opportunist','clansmen','hard','hard',('saltire','#2a4c9c','#f4f1e6'),
  'A proud northern kingdom bound to France by the Auld Alliance. England is always the problem.'),
 ('DAN','Denmark','Danish','#d65a5a','catholic','zealand','monarchy','opportunist','sound_toll','hard','normal',('nordic','#c0392b','#f4f1e6'),
  'Head of the Kalmar Union, master of the Sound. Keep Sweden in line and the Hansa in its place.'),
 ('SWE','Sweden','Swedish','#4a7fc1','catholic','svealand','monarchy','opportunist','svea_rike','hard','hard',('nordic','#2a62a8','#e8c547'),
  'A junior partner in the Kalmar Union, restless under Danish kings. Break free and make the Baltic a Swedish lake.'),
 ('BRA','Brandenburg','Brandenburger','#7a7f8f','catholic','brandenburg','monarchy','expansionist','margraviate','hard','hard',('charge','#f4f1e6','#b8322a','eagle'),
  'A poor elector in the sandy north. Discipline, patience and Prussia will make you great.'),
 ('MLO','Milan','Milanese','#c97c9d','catholic','lombardy','monarchy','opportunist','condottieri','hard','hard',('charge','#f4f1e6','#2a62a8','serpent'),
  'The richest city in Lombardy under its last Visconti duke. Hire the best condottieri and unite northern Italy.'),
 ('NAP','Naples','Neapolitan','#8fbf6a','catholic','naples','monarchy','opportunist','fertile_south','hard','hard',('quarterly','#e8c547','#b8322a'),
  'The south of Italy, ruled by an Aragonese line. Grow rich and claim the peninsula.'),
 ('TEU','Teutonic Order','Teutonic','#cfcbbb','catholic','prussia','theocracy','defensive','holy_order','hard','hard',('cross','#f4f1e6','#1f1f1f'),
  'A crusading order of knights ruling Prussia. Poland wants Danzig, and your towns are restless.'),
 ('BYZ','Byzantium','Byzantine','#8e2f6d','orthodox','constantinople','monarchy','defensive','heirs_of_rome','hard','very_hard',('cross','#8e1f2a','#e8c547'),
  'The last of Rome: one great city and the Morea. Survive the Ottoman storm, then restore the empire.'),
 ('PAP','Papal States','Papal','#f2e4a0','catholic','rome','theocracy','defensive','holy_see','minor',None,('pales','#e8c547','#f4f1e6'),
  'The Pope rules central Italy.'),
 ('SAV','Savoy','Savoyard','#b55050','catholic','savoy','monarchy','opportunist','alpine_passes','minor',None,('cross','#b8322a','#f4f1e6'),'Guardians of the Alpine passes.'),
 ('GEN','Genoa','Genoese','#9aa6c4','catholic','liguria','republic','trader','merchant_republic','minor',None,('cross','#f4f1e6','#b8322a'),'A merchant republic and rival of Venice.'),
 ('FLO','Florence','Florentine','#c96f9a','catholic','tuscany','republic','trader','medici_bank','minor',None,('charge','#f4f1e6','#b8322a','lis'),'The Medici bank rules Tuscany.'),
 ('BAV','Bavaria','Bavarian','#8db8d8','catholic','bavaria','monarchy','defensive','imperial_estate','minor',None,('lozengy','#4a8ad0','#f4f1e6'),'A Wittelsbach duchy in the south of the Empire.'),
 ('SAX','Saxony','Saxon','#6fae6a','catholic','saxony','monarchy','opportunist','silver_mines','minor',None,('barry','#1f1f1f','#e8c547'),'An electorate rich in silver.'),
 ('BRI','Brittany','Breton','#d9d2bd','catholic','brittany','monarchy','defensive','breton_ports','minor',None,('ermine','#f4f1e6','#1f1f1f'),'A proud duchy between France and the sea.'),
 ('NOV','Novgorod','Novgorodian','#a35a3a','orthodox','novgorod','republic','trader','hanseatic_kontor','minor',None,('charge','#b8322a','#e8c547','circle'),'Lord Novgorod the Great, a republic of furs and trade.'),
 ('MOL','Moldavia','Moldavian','#c9a03a','orthodox','moldavia','monarchy','defensive','boyars','minor',None,('charge','#2a4c9c','#e8c547','star'),'A principality between Poland, Hungary and the steppe.'),
 ('SER','Serbia','Serbian','#a84040','orthodox','serbia','monarchy','defensive','boyars','minor',None,('cross','#b8322a','#f4f1e6'),'A despotate under Ottoman shadow.'),
 ('CRI','Crimea','Crimean','#b5a46a','muslim','crimea','monarchy','expansionist','steppe_horde','minor',None,('charge','#2a8c87','#e8c547','tamga'),'A new khanate on the Black Sea.'),
 ('WAL','Wallachia','Wallachian','#7a5a3a','orthodox','wallachia','monarchy','defensive','boyars','minor',None,('charge','#2a4c9c','#e8c547','eagle'),'A Danube principality ruled by the Drăculești.'),
 ('BOS','Bosnia','Bosnian','#c9b44a','catholic','bosnia','monarchy','defensive','mountain_folk','minor',None,('bend','#2a4c9c','#e8c547'),'A mountain kingdom.'),
 ('ALB','Albania','Albanian','#8a1f1f','catholic','albania','monarchy','defensive','skanderbeg','minor',None,('charge','#b8322a','#1f1f1f','eagle'),'Skanderbeg’s League of Lezhë defies the sultan.'),
 ('NAV','Navarre','Navarrese','#d9a07a','catholic','navarre','monarchy','defensive','mountain_folk','minor',None,('saltire','#b8322a','#e8c547'),'A small Pyrenean kingdom.'),
 ('GRA','Granada','Granadan','#6a9a5a','muslim','granada','monarchy','defensive','alhambra','minor',None,('crescent','#b8322a','#e8c547'),'The last Muslim kingdom in Iberia.'),
 ('MOR','Morocco','Moroccan','#9a4f3a','muslim','fez','monarchy','opportunist','corsairs','minor',None,('star','#b8322a','#2d7a4c'),'The Marinid sultanate of Fez.'),
 ('TLE','Tlemcen','Tlemcenian','#c26a50','muslim','tlemcen','monarchy','opportunist','corsairs','minor',None,('crescent','#2d7a4c','#f4f1e6'),'A Zayyanid kingdom on the Barbary coast.'),
 ('TUN','Tunis','Tunisian','#b0885a','muslim','tunis','monarchy','opportunist','corsairs','minor',None,('crescent','#c0392b','#f4f1e6'),'The Hafsid sultanate of Ifriqiya.'),
 ('IRE','Ireland','Irish','#5fa05a','catholic','ireland','monarchy','defensive','gaelic','minor',None,('harp','#2d7a4c','#e8c547'),'Gaelic lords beyond the Pale.'),
 ('PRO','Provence','Provençal','#e8c060','catholic','provence','monarchy','defensive','imperial_estate','minor',None,('pales','#e8c547','#b8322a'),'René of Anjou’s sunny county, a French vassal.'),
 ('SWI','Switzerland','Swiss','#b03030','catholic','switzerland','republic','defensive','swiss_pikes','minor',None,('cross','#b8322a','#f4f1e6'),'The Confederation of the Alps.'),
 ('LOR','Lorraine','Lorrainer','#d7c44f','catholic','lorraine','monarchy','defensive','imperial_estate','minor',None,('bend','#e8c547','#b8322a'),'A duchy caught between France, Burgundy and the Empire.'),
 ('PAL','Palatinate','Palatine','#6a8ab0','catholic','palatinate','monarchy','defensive','imperial_estate','minor',None,('lozengy','#4a8ad0','#f4f1e6'),'An elector on the Rhine.'),
 ('KOL','Cologne','Cologner','#c8a8d8','catholic','cologne','theocracy','defensive','imperial_estate','minor',None,('cross','#f4f1e6','#1f1f1f'),'An archbishop-elector on the Rhine.'),
 ('MAI','Mainz','Mainzer','#a0c0e0','catholic','mainz','theocracy','defensive','imperial_estate','minor',None,('charge','#b8322a','#f4f1e6','wheel'),'The archbishop-elector, chancellor of the Empire.'),
 ('TRI','Trier','Trierer','#d0a080','catholic','trier','theocracy','defensive','imperial_estate','minor',None,('cross','#f4f1e6','#b8322a'),'An archbishop-elector on the Moselle.'),
 ('WUR','Württemberg','Württemberger','#e0c070','catholic','swabia','monarchy','defensive','imperial_estate','minor',None,('barry','#e8c547','#1f1f1f'),'A Swabian county with ambitions.'),
 ('LUN','Brunswick','Brunswicker','#c0b060','catholic','brunswick','monarchy','defensive','imperial_estate','minor',None,('charge','#b8322a','#e8c547','lion'),'A Welf duchy in Lower Saxony.'),
 ('HSA','Lübeck','Lübecker','#a05a5a','catholic','holstein','republic','trader','merchant_republic','minor',None,('fess','#f4f1e6','#b8322a'),'Queen of the Hansa.'),
 ('POM','Pomerania','Pomeranian','#9ab0d0','catholic','pomerania','monarchy','defensive','imperial_estate','minor',None,('charge','#f4f1e6','#b8322a','griffin'),'A Baltic duchy of griffins.'),
 ('LIV','Livonian Order','Livonian','#b0b0a0','catholic','livonia','theocracy','defensive','holy_order','minor',None,('cross','#f4f1e6','#1f1f1f'),'Crusader knights on the eastern Baltic.'),
 ('PSK','Pskov','Pskovian','#7a9a6a','orthodox','pskov','republic','defensive','boyars','minor',None,('charge','#2a4c9c','#e8c547','circle'),'A fortress republic on Lake Peipus.'),
 ('TVE','Tver','Tverian','#b0905a','orthodox','tver','monarchy','defensive','boyars','minor',None,('charge','#b8322a','#e8c547','tower'),'Muscovy’s old rival on the Volga.'),
 ('RYA','Ryazan','Ryazanian','#9a7a5a','orthodox','ryazan','monarchy','defensive','boyars','minor',None,('charge','#e8c547','#b8322a','circle'),'A principality on the steppe frontier.'),
 ('GOL','Great Horde','Horde','#c0a050','muslim','don','monarchy','expansionist','steppe_horde','minor',None,('charge','#e8c547','#b8322a','tamga'),'What remains of the Golden Horde.'),
 ('KAR','Karaman','Karamanid','#6a8a9a','muslim','karaman','monarchy','opportunist','anatolian_beys','minor',None,('crescent','#2a62a8','#e8c547'),'The strongest Anatolian beylik left.'),
 ('TRE','Trebizond','Trapezuntine','#8a6aa0','orthodox','trebizond','monarchy','defensive','heirs_of_rome','minor',None,('charge','#8e1f2a','#e8c547','eagle'),'The last Komnenian empire on the Black Sea.'),
 ('CYP','Cyprus','Cypriot','#a8d0c8','catholic','cyprus','monarchy','trader','sugar_trade','minor',None,('cross','#f4f1e6','#e8c547'),'The Lusignan kingdom of Cyprus.'),
 ('KNI','Knights Hospitaller','Hospitaller','#5a5a5a','catholic','rhodes','theocracy','defensive','holy_order','minor',None,('cross','#b8322a','#f4f1e6'),'The Knights of Saint John hold Rhodes.'),
]

# rulers: id -> (name, born, skill, traits) ; optional heirs
R = {
 'FRA':('Charles VII',1403,4,['shrewd']), 'ENG':('Henry VI',1421,1,['pious','feeble']), 'CAS':('Juan II',1405,2,['scholar']),
 'ARA':('Alfonso V',1396,4,['ambitious']), 'POR':('Afonso V',1432,2,['warrior']), 'BUR':('Philip the Good',1396,4,['diplomat']),
 'HAB':('Frederick III',1415,2,['scholar']), 'BOH':('George of Poděbrady',1420,4,['just']), 'HUN':('John Hunyadi',1407,5,['warrior']),
 'POL':('Zbigniew Oleśnicki',1389,3,['pious']), 'LIT':('Casimir IV',1427,3,['diplomat']), 'MOS':('Vasily II',1415,2,['cruel']),
 'TUR':('Murad II',1404,4,['warrior']), 'VEN':('Francesco Foscari',1373,4,['merchant']), 'SCO':('James II',1430,3,['warrior']),
 'DAN':('Christopher',1416,2,['spendthrift']), 'SWE':('Karl Knutsson',1408,3,['ambitious']), 'BRA':('Frederick II',1413,3,['administrator']),
 'MLO':('Filippo Maria Visconti',1392,3,['shrewd']), 'NAP':('Ferrante',1423,3,['cruel']), 'TEU':('Konrad von Erlichshausen',1390,3,['pious']),
 'BYZ':('John VIII',1392,2,['diplomat']), 'PAP':('Eugene IV',1383,3,['pious']), 'SAV':('Louis I',1413,2,['spendthrift']),
 'GEN':('Raffaele Adorno',1414,2,['merchant']), 'FLO':('Cosimo de’ Medici',1389,5,['merchant']), 'BAV':('Albert III',1401,3,['pious']),
 'SAX':('Frederick II',1412,3,['just']), 'BRI':('Francis I',1414,2,['builder']), 'NOV':('Archbishop Euthymius',1390,2,['pious']),
 'MOL':('Stephen II',1410,2,['cruel']), 'SER':('Đurađ Branković',1377,3,['builder']), 'CRI':('Hacı I Giray',1397,4,['warrior']),
 'WAL':('Vlad II Dracul',1395,3,['cruel']), 'BOS':('Stephen Thomas',1411,2,['pious']), 'ALB':('Skanderbeg',1405,5,['warrior']),
 'NAV':('John II',1398,3,['ambitious']), 'GRA':('Muhammad IX',1396,2,['craven']), 'MOR':('Abd al-Haqq II',1419,1,['feeble']),
 'TLE':('Abu al-Abbas Ahmad',1410,2,['merchant']), 'TUN':('Abu Amr Uthman',1419,4,['administrator']), 'IRE':('Eóghan Ó Néill',1390,2,['warrior']),
 'PRO':('René of Anjou',1409,3,['scholar']), 'SWI':('Federal Diet',1400,3,['just']), 'LOR':('John of Calabria',1424,2,['warrior']),
 'PAL':('Louis IV',1424,2,['pious']), 'KOL':('Dietrich von Moers',1385,3,['ambitious']), 'MAI':('Dietrich Schenk',1390,2,['diplomat']),
 'TRI':('Jakob von Sierck',1398,3,['shrewd']), 'WUR':('Ulrich V',1413,2,['spendthrift']), 'LUN':('Frederick the Pious',1408,2,['pious']),
 'HSA':('Lübeck Council',1400,3,['merchant']), 'POM':('Eric II',1425,2,['ambitious']), 'LIV':('Heidenreich Vincke',1395,2,['warrior']),
 'PSK':('Pskov Veche',1400,2,['just']), 'TVE':('Boris of Tver',1399,3,['builder']), 'RYA':('Ivan Fyodorovich',1410,2,['craven']),
 'GOL':('Küchük Muhammad',1405,2,['warrior']), 'KAR':('Ibrahim II',1410,3,['ambitious']), 'TRE':('John IV',1403,2,['spendthrift']),
 'CYP':('John II',1418,1,['feeble']), 'KNI':('Jean de Lastic',1371,3,['pious']),
}
H = {
 'FRA':('Louis',1423,2,['ambitious']), 'ENG':('Richard of York',1411,3,['ambitious']), 'CAS':('Henry',1425,1,['feeble']),
 'TUR':('Mehmed',1432,5,['ambitious']), 'BYZ':('Constantine',1405,3,['warrior']), 'BUR':('Charles',1433,3,['warrior']),
 'HAB':('Maximilian',1440,3,['diplomat']), 'MOS':('Ivan',1440,5,['shrewd']), 'POR':('João',1435,4,['administrator']),
 'ARA':('Ferdinand',1423,3,['shrewd']), 'SCO':('James',1451,2,['scholar']), 'DAN':('Christian of Oldenburg',1426,3,['diplomat']),
 'HUN':('Matthias Corvinus',1443,5,['administrator']), 'MLO':('Francesco Sforza',1401,4,['warrior']), 'POL':('Casimir',1427,3,['diplomat']),
}

TRAITS = {
 'national': {
  'gendarmes': ('Gendarmes','Heavy French cavalry and a royal standing army.', {'cavalryPower':0.15,'manpower':0.1}),
  'longbowmen': ('Longbowmen','English archers win battles they should lose.', {'infantryPower':0.2}),
  'reconquista': ('Reconquista','Crusading zeal against Muslim neighbours.', {'holyWarMorale':0.2,'coreCost':-0.2}),
  'crown_of_aragon': ('Crown of Aragon','A Mediterranean fleet and trading cities.', {'navalPower':0.25,'tradeIncome':0.1}),
  'navigators': ('Navigators','Sailors, cartographers and cheap caravels.', {'tradeIncome':0.2,'shipCost':-0.25}),
  'golden_fleece': ('Golden Fleece','The wealth of Flanders fills the ducal treasury.', {'taxIncome':0.15}),
  'aeiou': ('A.E.I.O.U.','Let others wage war; you, happy Austria, marry.', {'diplomacy':1,'opinion':10}),
  'hussite_wagons': ('Hussite Wagons','War wagons and drilled peasant armies.', {'morale':0.1,'fortDefense':0.1}),
  'bulwark': ('Bulwark of Christendom','Fortresses on the Danube frontier.', {'fortDefense':0.25,'holyWarMorale':0.1}),
  'szlachta': ('Szlachta','A nation of mounted nobles.', {'cavalryPower':0.2}),
  'grand_duchy': ('Vast Grand Duchy','Armies used to marching over great distances.', {'attrition':-0.4,'manpower':0.1}),
  'third_rome': ('Third Rome','The Orthodox world looks to Moscow.', {'manpower':0.25}),
  'ghazi': ('Ghazi Spirit','Frontier warriors of the faith.', {'morale':0.1,'holyWarMorale':0.1}),
  'merchant_republic': ('Merchant Republic','Ruled by merchants, with no succession crises.', {'tradeIncome':0.3}),
  'clansmen': ('Clansmen','Hardy highlanders who live off the land.', {'infantryPower':0.1,'attrition':-0.25}),
  'sound_toll': ('Sound Toll','Every ship into the Baltic pays Denmark.', {'tradeIncome':0.25}),
  'svea_rike': ('Svea Rike','Free peasants make stubborn soldiers.', {'infantryPower':0.15}),
  'margraviate': ('Mark Brandenburg','A poor land that makes do with less.', {'manpower':0.2,'upkeep':-0.1}),
  'condottieri': ('Condottieri','Italy’s best mercenary captains answer to Milan.', {'mercCost':-0.33}),
  'fertile_south': ('Fertile South','Rich land rewards investment.', {'devCost':-0.2}),
  'holy_order': ('Holy Order','Knights who fight to the last.', {'morale':0.15,'fortDefense':0.2}),
  'heirs_of_rome': ('Heirs of Rome','Ancient walls and ancient prestige.', {'fortDefense':0.5,'diplomacy':1}),
  'holy_see': ('Holy See','Catholic rulers think twice before attacking the Pope.', {'opinion':20,'prestigeGain':0.25}),
  'alpine_passes': ('Alpine Passes','Whoever holds the passes holds Italy’s door.', {'fortDefense':0.25}),
  'medici_bank': ('Medici Bank','Florentine gold buys friends and soldiers.', {'taxIncome':0.2}),
  'imperial_estate': ('Imperial Estate','A prince of the Empire with friends at court.', {'diplomacy':1}),
  'silver_mines': ('Silver Mines','The Erzgebirge pays for everything.', {'taxIncome':0.15}),
  'breton_ports': ('Breton Ports','Sailors and salt.', {'tradeIncome':0.2}),
  'hanseatic_kontor': ('Hanseatic Kontor','The fur trade flows through Novgorod.', {'tradeIncome':0.2}),
  'boyars': ('Boyars','Great landowners raise the levies.', {'manpower':0.15}),
  'steppe_horde': ('Steppe Horde','Horse archers who strike and vanish.', {'cavalryPower':0.25,'attrition':-0.3}),
  'mountain_folk': ('Mountain Folk','Hard to conquer, harder to hold.', {'fortDefense':0.2,'infantryPower':0.1}),
  'skanderbeg': ('League of Lezhë','Albania rallies behind its champion.', {'morale':0.2}),
  'alhambra': ('Alhambra','Granada’s fortresses are the strongest in Iberia.', {'fortDefense':0.3}),
  'corsairs': ('Barbary Corsairs','Raiders who live off the sea lanes.', {'navalPower':0.2,'tradeIncome':0.1}),
  'gaelic': ('Gaelic Lords','Bogs, forests and long memories.', {'attrition':-0.3,'unrest':-1}),
  'swiss_pikes': ('Swiss Pikemen','The finest infantry in Europe.', {'infantryPower':0.25}),
  'anatolian_beys': ('Anatolian Beys','Turkmen horsemen of the plateau.', {'cavalryPower':0.15}),
  'sugar_trade': ('Sugar Trade','Cyprus sweetens Europe’s tables.', {'tradeIncome':0.25}),
 },
 'ruler': {
  'warrior': ('Warrior','Leads from the front.', {'morale':0.1}),
  'administrator': ('Administrator','Keeps the books straight.', {'taxIncome':0.1}),
  'diplomat': ('Diplomat','A natural at court.', {'diplomacy':1,'opinion':10}),
  'pious': ('Pious','Beloved by the clergy.', {'unrest':-1}),
  'spendthrift': ('Spendthrift','Money runs through their fingers.', {'taxIncome':-0.1}),
  'cruel': ('Cruel','Feared at home, disliked abroad.', {'unrest':-1,'opinion':-15}),
  'just': ('Just','Fair judgements keep the peace.', {'unrest':-1}),
  'craven': ('Craven','Avoids danger at any cost.', {'morale':-0.1}),
  'scholar': ('Scholar','Patron of learning.', {'techCost':-0.15}),
  'ambitious': ('Ambitious','Wants more, and everyone knows it.', {'prestigeGain':0.25,'threatGain':0.1}),
  'feeble': ('Feeble','Easily led, easily ignored.', {'diplomacy':-1,'taxIncome':-0.05}),
  'shrewd': ('Shrewd','Sees the angles first.', {'taxIncome':0.05,'diplomacy':1}),
  'builder': ('Builder','Leaves cities better than they found them.', {'devCost':-0.15}),
  'merchant': ('Merchant','Understands money.', {'tradeIncome':0.15}),
 },
}

nations = []
for (nid,name,adj,color,faith,cap,gov,pers,trait,tier,diff,flag,desc) in N:
    rn,rb,rs,rt = R[nid]
    n = {'id':nid,'name':name,'adj':adj,'color':color,'faith':faith,'capital':cap,'gov':gov,'personality':pers,
         'trait':trait,'tier':tier,'playable': tier!='minor','difficulty':diff,
         'flag':{'pattern':flag[0],'colors':list(flag[1:3])} | ({'charge':flag[3]} if len(flag)>3 else {}),
         'ruler':{'name':rn,'born':rb,'skill':rs,'traits':rt},'desc':desc}
    if nid in H:
        hn,hb,hs,ht = H[nid]
        n['heir'] = {'name':hn,'born':hb,'skill':hs,'traits':ht}
    nations.append(n)

scenario = {
 'start': {'year':1444,'month':11,'day':11},
 'claims': {
   'FRA':['normandy','gascony','calais','provence','brittany'], 'ENG':['anjou','poitou','ile_de_france'],
   'CAS':['granada'], 'POR':['fez'], 'ARA':['naples','navarre'], 'TUR':['constantinople','morea','serbia','albania','bosnia'],
   'BYZ':['rumelia','bithynia','thessaly','macedonia'], 'HUN':['bosnia','serbia','wallachia'], 'POL':['danzig','prussia'],
   'MOS':['tver','novgorod','ryazan','pskov'], 'BUR':['lorraine','champagne'], 'HAB':['hungary','bohemia','switzerland'],
   'VEN':['lombardy'], 'MLO':['veneto'], 'BRA':['pomerania','altmark'], 'SCO':['yorkshire'], 'DAN':['holstein'],
   'SWE':['finland'], 'LIT':['moscow'], 'NAP':['sicily'], 'SAV':['lombardy'], 'KAR':['ankara'],
 },
 'alliances': [['FRA','SCO'],['FRA','CAS'],['ARA','NAP'],['POL','HUN'],['POL','LIT'],['TEU','LIV'],['HAB','BOH'],
               ['VEN','FLO'],['MLO','SAV'],['ENG','POR'],['BUR','LUN'],['TUR','KAR'],['MOS','TVE'],['NOV','PSK'],['GOL','CRI'],['HUN','WAL']],
 'subjects': [{'overlord':'FRA','subject':'PRO','type':'vassal'},{'overlord':'DAN','subject':'SWE','type':'union'},
              {'overlord':'TUR','subject':'SER','type':'vassal'},{'overlord':'POL','subject':'MOL','type':'vassal'}],
 'rivals': [['FRA','ENG'],['ENG','FRA'],['CAS','GRA'],['TUR','BYZ'],['TUR','HUN'],['HUN','TUR'],['POL','TEU'],['TEU','POL'],
            ['MOS','LIT'],['LIT','MOS'],['VEN','MLO'],['MLO','VEN'],['BUR','FRA'],['DAN','HSA'],['SCO','ENG'],['BYZ','TUR'],
            ['HAB','HUN'],['ARA','CAS'],['CAS','ARA'],['GEN','VEN'],['BRA','POM'],['MOS','NOV'],['KAR','TUR']],
 'truces': [{'a':'FRA','b':'ENG','years':4},{'a':'TUR','b':'HUN','years':2},{'a':'TUR','b':'POL','years':2}],
 'marriages': [['FRA','CAS'],['ARA','CAS'],['BUR','POR'],['HAB','POR'],['SCO','FRA'],['ENG','FRA']],
 'hre': {'emperor':'HAB','electors':['BOH','BRA','SAX','PAL','MAI','KOL','TRI']},
}

def fmt_nations(ns):
    return '[\n' + ',\n'.join('  ' + json.dumps(n, ensure_ascii=False) for n in ns) + '\n]\n'
open(os.path.join(ROOT,'src/content/nations.json'),'w').write(fmt_nations(nations))
open(os.path.join(ROOT,'src/content/scenario1444.json'),'w').write(json.dumps(scenario, ensure_ascii=False, indent=1) + '\n')
traits = {k: {tid: {'name':v[0],'desc':v[1],'mods':v[2]} for tid,v in d.items()} for k,d in TRAITS.items()}
open(os.path.join(ROOT,'src/content/traits.json'),'w').write(
  '{\n' + ',\n'.join(f'  "{k}": {{\n' + ',\n'.join(f'    "{tid}": ' + json.dumps(t, ensure_ascii=False) for tid,t in d.items()) + '\n  }' for k,d in traits.items()) + '\n}\n')
regions = json.load(open(os.path.join(ROOT,'src/content/regions.json')))
ids = {n['id'] for n in nations}
rids = {r['id'] for r in regions}
for r in regions: assert r['owner'] in ids, r
for n in nations: assert n['capital'] in rids and next(r for r in regions if r['id']==n['capital'])['owner']==n['id'], n['id']
for n in nations: assert n['trait'] in traits['national'], n['trait']
owned = {n['id']: sum(1 for r in regions if r['owner']==n['id']) for n in nations}
print(len(nations), 'nations;', 'no land:', [k for k,v in owned.items() if v==0])
