/* eslint-disable */
/**
 * CP Phantom rules catalogs — copied VERBATIM from index.html's object literals
 * (2026-08-31). Pure data, no code. These change rarely; if CP Phantom's
 * catalogs are updated, re-run scripts/extract_catalogs to resync.
 * Source of truth for talent/technique/hack/cyberware/attachment/consumable
 * mechanics — SOLO_MODE_BUILD_PLAN.md §3.1 / §8.1.
 */

export const ATTACHMENT_CATALOG = [
  {name:'Iron Sights Upgrade', effect:'+2 weapon bonus beyond 12m, while still within the weapon\'s effective range (§6.4a/§7.7)', costTier:'guenstig', mods:[{appliesTo:'wb', amount:2, conditional:true, label:'Beyond 12m, within effective range'}]},
  {name:'2.5x Scope', effect:'+4 weapon bonus beyond 12m within effective range (§6.4a/§7.7), -2 PW on Autofire', costTier:'normal', mods:[{appliesTo:'wb', amount:4, conditional:true, label:'Beyond 12m, within effective range'}, {appliesTo:'pw', amount:-2, conditional:true, label:'Autofire'}]},
  {name:'Sniper Scope', effect:'+6 weapon bonus beyond effective range up to maximum range (§6.4a/§7.7), no Autofire', costTier:'teuer', mods:[{appliesTo:'wb', amount:6, conditional:true, label:'Beyond effective, within max range'}]},
  {name:'Thermal Scope', effect:'Sees through smoke/darkness, +2 weapon bonus at night', costTier:'teuer', mods:[{appliesTo:'wb', amount:2, conditional:true, label:'Night/darkness'}]},
  {name:'Smart Scope', effect:'Requires Neural Link. +1 weapon bonus always.', costTier:'sehr teuer', alwaysOn:{bonus:1}},
  {name:'Suppressor', effect:'Shot inaudible beyond 15m, -1 weapon bonus', costTier:'normal', alwaysOn:{bonus:-1}},
  {name:'Muzzle Brake', effect:'-2 Autofire PW penalty', costTier:'normal', mods:[{appliesTo:'pw', amount:-2, conditional:true, label:'Autofire'}]},
  {name:'Extended Barrel', effect:'+2 weapon bonus beyond effective range (§6.4a/§7.7), no longer concealable', costTier:'normal', mods:[{appliesTo:'wb', amount:2, conditional:true, label:'Beyond effective range'}]},
  {name:'Compensator', effect:'Blindfire: 1/4 PW → 1/2 PW', costTier:'teuer'},
  {name:'Laser Sight', effect:'Darkness PW penalty reduced by 4', costTier:'normal', mods:[{appliesTo:'pw', amount:4, conditional:true, label:'Darkness (offsets penalty)'}]},
  {name:'UV Laser Sight', effect:'Like Laser Sight, only visible with Cyberoptics', costTier:'teuer', mods:[{appliesTo:'pw', amount:4, conditional:true, label:'Darkness, Cyberoptics only'}]},
  {name:'Foregrip', effect:'+1 weapon bonus while standing', costTier:'guenstig', mods:[{appliesTo:'wb', amount:1, conditional:true, label:'Standing'}]},
  {name:'Bipod', effect:'+4 PW while prone/braced, no movement', costTier:'normal', mods:[{appliesTo:'pw', amount:4, conditional:true, label:'Prone/braced'}]},
  {name:'Grenade Launcher', effect:'1x/combat: Focus+Strength, +14 in 3m radius', costTier:'sehr teuer'},
  {name:'Flashlight', effect:'Eliminates darkness penalty, but reveals position', costTier:'guenstig'},
  {name:'Extended Magazine', effect:'+2 magazine ticks', costTier:'normal', magEffect:{add:2}},
  {name:'Drum Magazine', effect:'Doubles magazine, -1 Speed', costTier:'teuer', magEffect:{multiply:2}},
  {name:'Quick-Release Mag', effect:'Reload as a free action, once per combat', costTier:'teuer'},
] as const;

export const MELEE_MOD_CATALOG = [
  {name:'Monofilament Edge', effect:'+2 weapon bonus, ignores SP under 6', costTier:'teuer', alwaysOn:{bonus:2}},
  {name:'Vibroblade', effect:'+3 weapon bonus, battery (5 fights)', costTier:'teuer', alwaysOn:{bonus:3}},
  {name:'Weighted Grip', effect:'+1 weapon bonus, +1 damage per meter of movement bonus', costTier:'normal', alwaysOn:{bonus:1}},
  {name:'Shock Element', effect:'On Crit Success: target loses its secondary action next round', costTier:'sehr teuer'},
  {name:'Serrated Edge', effect:'Bleed on Crit Success: 2 dmg/round until treated', costTier:'normal'},
  {name:'Concealable Holster', effect:'Weapon up to Medium Melee becomes concealable', costTier:'guenstig'},
] as const;

export const TALENT_CATALOG = {
  Netrunner: [
    { name: 'Jack In', levels: [
      { lvl:'I', req:'Mind 8', effect:'+1 IP/round', mods:[], regen_stat:'ip', regen_amount:1 },
      { lvl:'II', req:'Mind 12', effect:'+2 IP/round', mods:[], regen_stat:'ip', regen_amount:2 },
      { lvl:'III', req:'Mind 16', effect:'+3 IP/round', mods:[], regen_stat:'ip', regen_amount:3 },
      { lvl:'IV', req:'Mind 20', effect:'+4 IP/round', mods:[], regen_stat:'ip', regen_amount:4 },
      { lvl:'V', req:'Mind 25', effect:'+5 IP/round. Max IP pool +5.', mods:[], regen_stat:'ip', regen_amount:5, maxBonus:{stat:'ip', amount:5} },
    ]},
    { name: 'RAM Recovery', levels: [
      { lvl:'I', req:'Mind 10', effect:'On hack-kill: +2 IP instantly', mods:[], trigger:{label:'Hack-kill: +2 IP', effects:[{stat:'ip',delta:2}]} },
      { lvl:'II', req:'Mind 14', effect:'On hack-kill: +4 IP instantly', mods:[], trigger:{label:'Hack-kill: +4 IP', effects:[{stat:'ip',delta:4}]} },
      { lvl:'III', req:'Mind 18', effect:'On hack-kill: +4 IP + all hack cooldowns -1 round', mods:[], trigger:{label:'Hack-kill: +4 IP', effects:[{stat:'ip',delta:4}]} },
    ]},
    { name: 'Deep Reserves', levels: [
      { lvl:'I', req:'Mind 8', effect:'Max IP pool +4', mods:[], maxBonus:{stat:'ip', amount:4} },
      { lvl:'II', req:'Mind 12', effect:'Max IP pool +8', mods:[], maxBonus:{stat:'ip', amount:8} },
      { lvl:'III', req:'Mind 20', effect:'Max IP pool +12. Starts every fight at full IP.', mods:[], maxBonus:{stat:'ip', amount:12}, fullIpAtCombatStart:true },
    ]},
    { name: 'Efficient Code', levels: [
      { lvl:'I', req:'Mind 12', effect:'Control Hacks cost 1 IP less (min. 1)', mods:[], hackIpDiscount:{Control:1} },
      { lvl:'II', req:'Mind 16', effect:'Combat Hacks also cost 1 IP less', mods:[], hackIpDiscount:{Control:1, Combat:1} },
      { lvl:'III', req:'Mind 20', effect:'Utility Hacks also cost 1 IP less', mods:[], hackIpDiscount:{Control:1, Combat:1, Utility:1} },
      { lvl:'IV', req:'Mind 24', effect:'ALL hacks cost 1 IP less (stacks with I-III)', mods:[], hackIpDiscount:{Control:2, Combat:2, Utility:2, Environment:1, Duel:1} },
    ]},
    { name: 'System Expertise', levels: [
      { lvl:'I', req:'Mind 8', effect:'+2 PW on all Routine Hacks (Int+Focus)', mods:[{appliesTo:'pw',scope:'hacks',amount:2,conditional:false}] },
      { lvl:'II', req:'Mind 12', effect:'+2 PW on all Exotic Hacks (Int+Creativity) too', mods:[{appliesTo:'pw',scope:'hacks',amount:2,conditional:false}] },
      { lvl:'III', req:'Mind 16', effect:'+2 PW on ALL hacks (stacks)', mods:[{appliesTo:'pw',scope:'hacks',amount:2,conditional:false}] },
      { lvl:'IV', req:'Mind 22', effect:'+2 PW all hacks. Crit Fail has no downside anymore — the hack just fails.', mods:[{appliesTo:'pw',scope:'hacks',amount:2,conditional:false}] },
    ]},
    { name: 'Exploit', levels: [
      { lvl:'I', req:'Mind 10', effect:'+2 PW on hacks vs targets with active Cyberware Malfunction', mods:[{appliesTo:'pw',scope:'hacks',amount:2,conditional:true}] },
      { lvl:'II', req:'Mind 14', effect:'+4 PW vs Malfunction targets', mods:[{appliesTo:'pw',scope:'hacks',amount:4,conditional:true}] },
      { lvl:'III', req:'Mind 18', effect:'+4 PW. Short Circuit on a Malfunction target ignores Firewall entirely.', mods:[{appliesTo:'pw',scope:'hacks',amount:4,conditional:true}] },
    ]},
    { name: 'Firewall Bypass', levels: [
      { lvl:'I', req:'Mind 10', effect:"Target's Firewall counts as 3 lower", mods:[{appliesTo:'targetFirewall',amount:3,conditional:false}] },
      { lvl:'II', req:'Mind 15', effect:'Firewall counts as 6 lower', mods:[{appliesTo:'targetFirewall',amount:6,conditional:false}] },
      { lvl:'III', req:'Mind 20', effect:'Firewall counts as 10 lower. Non-cybered targets: Sonic Shock/Memory Wipe become possible.', mods:[{appliesTo:'targetFirewall',amount:10,conditional:false}] },
    ]},
    { name: 'Cascade', levels: [
      { lvl:'I', req:'Mind 10', effect:'Hack spreading to a 2nd target costs 1 IP less', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'All hacks’ spread range +3m', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'Hack can spread to 1 additional target', mods:[] },
    ]},
    { name: 'Embedded Exploit', levels: [
      { lvl:'I', req:'Mind 12', effect:'Combat Hacks: +30% damage', mods:[] },
      { lvl:'II', req:'Mind 20', effect:'Combat Hacks: +60% damage. Crit Success also applies a status effect.', mods:[] },
    ]},
    { name: 'Overclock', levels: [
      { lvl:'I', req:'— (core mechanic)', effect:'Pay 1 HP to gain 2 IP, any time, no limit. A non-hack action ends Overclock immediately (2-round hack cooldown after). IP regen pauses while active.', mods:[], trigger:{label:'Overclock: -1 HP → +2 IP', effects:[{stat:'hp',delta:-1},{stat:'ip',delta:2}]} },
      { lvl:'II', req:'Mind 16', effect:'Ratio improves to 1:1. Max 5 rounds. Same exit rule/cooldown.', mods:[], trigger:{label:'Overclock: -1 HP → +1 IP', effects:[{stat:'hp',delta:-1},{stat:'ip',delta:1}]} },
      { lvl:'III', req:'Mind 22', effect:'No round limit, 1:1 ratio, but 1 HP/round passive drain while active. Immune to Control Hacks while active. At 0 HP during Overclock: Grit roll — success knocked out, failure knocked out + permanent -1 Will.', mods:[], trigger:{label:'Overclock: -1 HP → +1 IP', effects:[{stat:'hp',delta:-1},{stat:'ip',delta:1}]} },
    ]},
    { name: 'Ghost Protocol', levels: [
      { lvl:'I', req:'Mind 10', effect:'Hacks on Sonic-Shocked targets are untraceable', mods:[] },
      { lvl:'II', req:'Mind 15', effect:'All Utility Hacks always untraceable', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'After a stealth kill: all active hack effects refresh their duration', mods:[] },
    ]},
    { name: 'Neural Shunt', levels: [
      { lvl:'I', req:'Mind 12', effect:'Incoming hacks: 1/round auto-blocked', mods:[] },
      { lvl:'II', req:'Mind 16', effect:'Blocked hacks: attacker loses 3 IP (feedback)', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'Can redirect a received hack — instant counter-hack, no action cost', mods:[] },
    ]},
    { name: 'Deep Scan', levels: [
      { lvl:'I', req:'Mind 8', effect:'Ping reveals Firewall, HP and cyberware of every pinged target', mods:[] },
      { lvl:'II', req:'Mind 16', effect:'1x/fight: full scan of a target — +4 PW on all hacks vs it for the fight', mods:[{appliesTo:'pw',scope:'hacks',amount:4,conditional:true,label:'After full scan (1x/fight)'}], usesPerFight:1 },
    ]},
    { name: 'Daemon Upload', levels: [
      { lvl:'I', req:'Mind 20', effect:'1x/fight: deploy a Daemon for 4 IP — auto-uploads Cyberware Malfunction on a target every round', mods:[] },
      { lvl:'II', req:'Mind 25', effect:'Daemon can also upload Contagion (choose at deploy). Lasts 4 rounds.', mods:[] },
    ]},
  ],
  Melee: [
    { name: 'Wuchtig', levels: [
      { lvl:'I', req:'Power 8', effect:'Movement damage bonus: +3 (not +2) per meter moved', mods:[] },
      { lvl:'II', req:'Power 12', effect:'+4 per meter', mods:[] },
      { lvl:'III', req:'Power 16', effect:'+5 per meter', mods:[] },
      { lvl:'IV', req:'Power 20', effect:'+5/meter. First attack after 3m+ movement: knockback (1d3m) on target Will-roll failure.', mods:[] },
      { lvl:'V', req:'Power 24', effect:'+6/meter. Knockback always, no Will-roll.', mods:[] },
    ]},
    { name: 'Praezisionsschlag', levels: [
      { lvl:'I', req:'Power 10', effect:'+2 Weapon Bonus, melee', mods:[{appliesTo:'wb',scope:'melee',amount:2,conditional:false}] },
      { lvl:'II', req:'Power 14', effect:'+4 Weapon Bonus, melee', mods:[{appliesTo:'wb',scope:'melee',amount:4,conditional:false}] },
      { lvl:'III', req:'Power 18', effect:'+6 Weapon Bonus, melee', mods:[{appliesTo:'wb',scope:'melee',amount:6,conditional:false}] },
      { lvl:'IV', req:'Power 22', effect:'+6 WB. Crit Success: Weapon Bonus doubled on that hit.', mods:[{appliesTo:'wb',scope:'melee',amount:6,conditional:false}] },
    ]},
    { name: 'Ruestungsbrecher', levels: [
      { lvl:'I', req:'Power 10', effect:'Melee hits reduce target SP by 1 per hit', mods:[{appliesTo:'armorAblation',scope:'melee',amount:0,conditional:false}] },
      { lvl:'II', req:'Power 14', effect:'SP reduction: 2 per hit', mods:[{appliesTo:'armorAblation',scope:'melee',amount:1,conditional:false}] },
      { lvl:'III', req:'Power 18', effect:'SP reduction: 3. Crit Success: 6 (not automated — apply the extra manually on a crit).', mods:[{appliesTo:'armorAblation',scope:'melee',amount:2,conditional:false}] },
    ]},
    { name: 'Kampfrausch', levels: [
      { lvl:'I', req:'Power 10', effect:'After a melee kill: +2 PW on the next attack this round', mods:[{appliesTo:'pw',scope:'melee',amount:2,conditional:true}] },
      { lvl:'II', req:'Power 14', effect:'After kill: +2 PW + +3 Weapon Bonus', mods:[{appliesTo:'pw',scope:'melee',amount:2,conditional:true},{appliesTo:'wb',scope:'melee',amount:3,conditional:true}] },
      { lvl:'III', req:'Power 20', effect:'After kill: +4 PW + +5 Weapon Bonus. Stacks up to 3x/fight.', mods:[{appliesTo:'pw',scope:'melee',amount:4,conditional:true},{appliesTo:'wb',scope:'melee',amount:5,conditional:true}] },
    ]},
    { name: 'Kritische Masse', levels: [
      { lvl:'I', req:'Power 12', effect:'Melee Crit Success: Bleed (2 dmg/round, 3 rounds) OR Stagger (target loses secondary action)', mods:[], statusGrantChoice:[{type:'bleed',name:'Bleed (Kritische Masse)',rounds:3},{type:'stagger',name:'Stagger (Kritische Masse)',rounds:1}] },
      { lvl:'II', req:'Power 22', effect:'Crit Success: both status effects at once. Target gets no reaction roll.', mods:[], statusGrantChoice:[{type:'bleed',name:'Bleed (Kritische Masse)',rounds:3},{type:'stagger',name:'Stagger (Kritische Masse)',rounds:1}] },
    ]},
    { name: 'Eisenhaut', levels: [
      { lvl:'I', req:'Power 8', effect:'+1 SP permanent', mods:[], maxBonus:{stat:'armor', amount:1} },
      { lvl:'II', req:'Power 12', effect:'+2 SP', mods:[], maxBonus:{stat:'armor', amount:2} },
      { lvl:'III', req:'Power 16', effect:'+3 SP', mods:[], maxBonus:{stat:'armor', amount:3} },
      { lvl:'IV', req:'Power 20', effect:'+4 SP. Seriously Wounded malus halved (-1 instead of -2).', mods:[], maxBonus:{stat:'armor', amount:4} },
      { lvl:'V', req:'Power 24', effect:'+5 SP. Seriously Wounded malus gone entirely.', mods:[], maxBonus:{stat:'armor', amount:5} },
    ]},
    { name: 'Regenerationsgewebe', levels: [
      { lvl:'I', req:'Power 10', effect:'Regenerates 1 HP/round in combat (passive, while > 0 HP). Full heal after 10 min outside combat.', mods:[], regen_stat:'hp', regen_amount:1 },
      { lvl:'II', req:'Power 14', effect:'2 HP/round in combat. Bleed effects halved.', mods:[], regen_stat:'hp', regen_amount:2 },
      { lvl:'III', req:'Power 18', effect:'3 HP/round. Immune to Bleed (wounds close instantly).', mods:[], regen_stat:'hp', regen_amount:3 },
      { lvl:'IV', req:'Power 22', effect:'5 HP/round. 1x/fight below 25% HP: instant 2d6+6 HP (adrenaline surge).', mods:[], regen_stat:'hp', regen_amount:5 },
    ]},
    { name: 'Kampfinstinkt', levels: [
      { lvl:'I', req:'Mobility 8', effect:'+3 reaction-roll PW when attacked in melee', mods:[{appliesTo:'reaction',amount:3,conditional:true,label:'Attacked in melee'}] },
      { lvl:'II', req:'Mobility 12', effect:'+6 reaction-roll PW in melee', mods:[{appliesTo:'reaction',amount:6,conditional:true,label:'Attacked in melee'}] },
      { lvl:'III', req:'Mobility 16', effect:'+6 RW-PW. Second-attacker malus reduced to -3 (from -5).', mods:[{appliesTo:'reaction',amount:6,conditional:true,label:'Attacked in melee'}] },
      { lvl:'IV', req:'Mobility 20', effect:'+8 RW-PW. Additional-attacker malus removed entirely.', mods:[{appliesTo:'reaction',amount:8,conditional:true,label:'Attacked in melee'}] },
    ]},
    { name: 'Standhaft', levels: [
      { lvl:'I', req:'Power 10', effect:'Range to shield an ally: +2m', mods:[] },
      { lvl:'II', req:'Power 14', effect:'+4m. Reaction roll while shielding has no malus.', mods:[] },
      { lvl:'III', req:'Power 18', effect:'+6m. Can shield an ally even after an offensive main action.', mods:[] },
    ]},
    { name: 'Bollwerk', levels: [
      { lvl:'I', req:'Power 10, shield equipped', effect:'Block also covers one adjacent ally (frontal). Shield-wall range +1m.', mods:[] },
      { lvl:'II', req:'Power 14, Bollwerk I', effect:'Shield Bash as secondary action: Str+Grit, +5 WB, Stagger on hit. Block SP +2.', mods:[] },
      { lvl:'III', req:'Power 18, Bollwerk II', effect:'Shield-wall covers a 2m arc (multiple allies). Reflects ram/charge attacks: attacker takes half their own damage.', mods:[] },
    ]},
    { name: 'Zaeh wie Leder', levels: [
      { lvl:'I', req:'Power 12', effect:'Mortally Wounded only kicks in at <=20% Health instead of 0 HP', mods:[] },
      { lvl:'II', req:'Power 16', effect:'At 0 HP: Grit roll — success stays up on 1 HP (1x/fight)', mods:[] },
      { lvl:'III', req:'Power 22', effect:'At 0 HP: fights a full round before collapsing, no roll needed', mods:[] },
    ]},
    { name: 'Zweiter Atem', levels: [
      { lvl:'I', req:'Mobility 10', effect:'Stamina regen in combat: 1/round', mods:[], regen_stat:'stamina', regen_amount:1 },
      { lvl:'II', req:'Mobility 12', effect:'2/round', mods:[], regen_stat:'stamina', regen_amount:2 },
      { lvl:'III', req:'Mobility 15', effect:'3/round', mods:[], regen_stat:'stamina', regen_amount:3 },
      { lvl:'IV', req:'Mobility 18', effect:'4/round', mods:[], regen_stat:'stamina', regen_amount:4 },
      { lvl:'V', req:'Mobility 22', effect:'5/round', mods:[], regen_stat:'stamina', regen_amount:5 },
    ]},
    { name: 'Ruinous Charge', levels: [
      { lvl:'I', req:'Mobility 8', effect:'First 2m/round: no melee malus', mods:[] },
      { lvl:'II', req:'Mobility 12', effect:'First 4m without malus', mods:[] },
      { lvl:'III', req:'Mobility 16', effect:'First 6m without malus', mods:[] },
      { lvl:'IV', req:'Mobility 20', effect:'First 8m without malus', mods:[] },
    ]},
    { name: 'Schattentaenzer', levels: [
      { lvl:'I', req:'Mobility 10', effect:'Dodge: +2m bonus movement without malus', mods:[] },
      { lvl:'II', req:'Mobility 14', effect:'+4m. Enemy: -3 PW on follow-up attacks.', mods:[] },
      { lvl:'III', req:'Mobility 20', effect:'+4m. After a successful dodge: free counter-attack at half PW.', mods:[] },
    ]},
    { name: 'Flankenangriff', levels: [
      { lvl:'I', req:'Mobility 10', effect:'Attack from behind/side: +4 PW', mods:[{appliesTo:'pw',scope:'melee',amount:4,conditional:true}] },
      { lvl:'II', req:'Mobility 14', effect:'Flank: +4 PW + target gets no reaction roll', mods:[{appliesTo:'pw',scope:'melee',amount:4,conditional:true}] },
      { lvl:'III', req:'Mobility 18', effect:'Flank: +6 PW + no reaction roll + increased crit chance', mods:[{appliesTo:'pw',scope:'melee',amount:6,conditional:true}] },
    ]},
    { name: 'Wilder Ansturm', levels: [
      { lvl:'I', req:'Mobility 15', effect:'1x/fight: move up to 8m and attack with no movement malus. 6m+ distance: +4 damage.', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 20', effect:'2x/fight. Targets hit along the way take half attack value as damage.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Entwaeffnen', levels: [
      { lvl:'I', req:'Power 12', effect:'Dex+Strength roll instead of damage: success drops the weapon (uses secondary action)', mods:[] },
      { lvl:'II', req:'Power 18', effect:'Can catch the weapon — usable immediately', mods:[] },
    ]},
    { name: 'Toedlicher Rhythmus', levels: [
      { lvl:'I', req:'Power 15', effect:'Second Flink attack: no PW malus', mods:[] },
      { lvl:'II', req:'Power 20', effect:'Third Flink attack: +3 Weapon Bonus', mods:[] },
      { lvl:'III', req:'Power 25', effect:'Every further Flink attack: +3 Weapon Bonus, cumulative', mods:[] },
    ]},
  ],
  Ranged: [
    { name: 'Scharfschuetze', levels: [
      { lvl:'I', req:'Mobility 8', effect:'+2 PW on all ranged attacks', mods:[{appliesTo:'pw',scope:'ranged',amount:2,conditional:false}] },
      { lvl:'II', req:'Mobility 12', effect:'+4 PW', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:false}] },
      { lvl:'III', req:'Mobility 16', effect:'+6 PW', mods:[{appliesTo:'pw',scope:'ranged',amount:6,conditional:false}] },
      { lvl:'IV', req:'Mobility 20', effect:'+8 PW. Stationary: +2 extra on the first attack.', mods:[{appliesTo:'pw',scope:'ranged',amount:8,conditional:false}] },
      { lvl:'V', req:'Mobility 25', effect:'+10 PW. No movement malus at up to 2m moved.', mods:[{appliesTo:'pw',scope:'ranged',amount:10,conditional:false}] },
    ]},
    { name: 'Waffenmeister', levels: [
      { lvl:'I', req:'Power 10', effect:'+2 Weapon Bonus, ranged', mods:[{appliesTo:'wb',scope:'ranged',amount:2,conditional:false}] },
      { lvl:'II', req:'Power 14', effect:'+4 Weapon Bonus, ranged', mods:[{appliesTo:'wb',scope:'ranged',amount:4,conditional:false}] },
      { lvl:'III', req:'Power 18', effect:'+6 Weapon Bonus, ranged', mods:[{appliesTo:'wb',scope:'ranged',amount:6,conditional:false}] },
      { lvl:'IV', req:'Power 22', effect:'+6 WB. Crit Success: Weapon Bonus doubled.', mods:[{appliesTo:'wb',scope:'ranged',amount:6,conditional:false}] },
    ]},
    { name: 'Ruhige Hand', levels: [
      { lvl:'I', req:'Mobility 8', effect:'First 2m: no ranged malus', mods:[] },
      { lvl:'II', req:'Mobility 12', effect:'First 4m without malus', mods:[] },
      { lvl:'III', req:'Mobility 16', effect:'First 6m without malus', mods:[] },
      { lvl:'IV', req:'Mobility 20', effect:'First 8m without malus', mods:[] },
    ]},
    { name: 'Gezielte Schuesse', levels: [
      { lvl:'I', req:'Mobility 10', effect:'Head: -4 PW, Stagger on hit', mods:[], statusGrantChoice:[{type:'stagger',name:'Stagger (Headshot)',rounds:1}] },
      { lvl:'II', req:'Mobility 14', effect:'Legs: -3 PW, Speed halved 2 rounds on hit', mods:[], statusGrantChoice:[{type:'stagger',name:'Stagger (Headshot)',rounds:1},{type:'custom',name:'Speed halved (Legshot)',rounds:2}] },
      { lvl:'III', req:'Mobility 18', effect:'Weapon: -5 PW, weapon drops. Headshot Crit Success = instant KO.', mods:[], statusGrantChoice:[{type:'stagger',name:'Stagger (Headshot)',rounds:1},{type:'custom',name:'Speed halved (Legshot)',rounds:2}] },
    ]},
    { name: 'Durchschlagende Kraft', levels: [
      { lvl:'I', req:'Power 10', effect:'Shots ignore light cover (wood, glass)', mods:[] },
      { lvl:'II', req:'Power 14', effect:'Medium cover too. Target SP counts as 3 lower.', mods:[] },
      { lvl:'III', req:'Power 20', effect:'All but heavy cover. SP counts as 6 lower.', mods:[] },
    ]},
    { name: 'Munitionseffizienz', levels: [
      { lvl:'I', req:'Mobility 8', effect:'Autofire uses 1.5x magazine instead of 2x', mods:[] },
      { lvl:'II', req:'Mobility 12', effect:'Autofire uses normal magazine consumption', mods:[] },
      { lvl:'III', req:'Mobility 18', effect:'Suppressive Fire: normal consumption. 1x/fight a shot costs no tick.', mods:[], usesPerFight:1 },
    ]},
    { name: 'Hawk Eye', levels: [
      { lvl:'I', req:'Mind 8', effect:'+2 on Focus+Senses rolls (Sniper PW)', mods:[{appliesTo:'pw',scope:'ranged',amount:2,conditional:false}] },
      { lvl:'II', req:'Mind 12', effect:'+4 on Focus+Senses rolls', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:false}] },
      { lvl:'III', req:'Mind 16', effect:'+6. Sniper Rifle can attack beyond its maximum range if the target is clearly perceived and a ballistic line of sight exists — such attacks use half PW (another effect, e.g. Atempause, can remove that halving).', mods:[{appliesTo:'pw',scope:'ranged',amount:6,conditional:false}] },
      { lvl:'IV', req:'Mind 20', effect:'+8. Can fire through smoke/dim light without malus.', mods:[{appliesTo:'pw',scope:'ranged',amount:8,conditional:false}] },
    ]},
    { name: 'Deckungsmeister', levels: [
      { lvl:'I', req:'Mobility 8', effect:'Feuerbereitschaft reaction shots against your Quick Peek use only half PW. Snap Shot, Killzone and other explicitly-named talent reaction shots still use their own stated PW.', mods:[] },
      { lvl:'II', req:'Mobility 12', effect:'Blindfire: 1/4 PW -> 1/3 PW', mods:[] },
      { lvl:'III', req:'Mobility 18', effect:'Blindfire: 1/3 PW -> 1/2 PW. Scope bonuses also apply on blindfire.', mods:[] },
    ]},
    { name: 'Erste Kugel', levels: [
      { lvl:'I', req:'Mobility 10', effect:'First shot of the fight: +4 PW', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:true}] },
      { lvl:'II', req:'Mobility 14', effect:'+6 PW. First shot ignores target reaction roll.', mods:[{appliesTo:'pw',scope:'ranged',amount:6,conditional:true}] },
      { lvl:'III', req:'Mobility 22', effect:'+8 PW. Crit Success: fight starts with an extra free AP.', mods:[{appliesTo:'pw',scope:'ranged',amount:8,conditional:true}] },
    ]},
    { name: 'Doppelschuss', levels: [
      { lvl:'I', req:'Mobility 15', effect:'2x/fight: two shots as one main action. Second shot -4 PW.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'Mobility 20', effect:'Second shot -2 PW. Can target different targets.', mods:[], usesPerFight:2 },
      { lvl:'III', req:'Mobility 25', effect:'Second shot no PW malus. 3x/fight.', mods:[], usesPerFight:3 },
    ]},
    { name: 'Snap Shot', levels: [
      { lvl:'I', req:'Mobility 15', effect:'1x/round, when a visible enemy uses Quick Peek or starts a visible attack: immediate reaction shot at half PW. No prior Feuerbereitschaft needed. Normal ammo/Stamina cost. Target still gets a normal defensive reaction unless another rule prevents it.', mods:[] },
      { lvl:'II', req:'Mobility 20', effect:'Snap Shot at full PW. Can also trigger off — and resolve before — a visible enemy\'s Flink announcement.', mods:[] },
    ]},
    { name: 'Ghost Shot', levels: [
      { lvl:'I', req:'Mobility 10', effect:'With Suppressor: stay in stealth after firing if stationary', mods:[] },
      { lvl:'II', req:'Mobility 18', effect:'Also without Suppressor (1x/fight). With Suppressor: permanent stealth while stationary.', mods:[], usesPerFight:1 },
    ]},
    { name: 'Suppression Spezialist', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Suppressive Fire: Will-roll -3. Zone up to 6m wide.', mods:[] },
      { lvl:'II', req:'Mobility 18', effect:'Targets who fail also lose their reaction roll. Zone up to 10m.', mods:[] },
    ]},
    { name: 'Trick Shot', levels: [
      { lvl:'I', req:'Mind 12', effect:'Ricochet around cover: -6 PW, target cannot react', mods:[] },
      { lvl:'II', req:'Mind 20', effect:'Ricochet: -3 PW. Can split across 2 targets (second at -4 PW).', mods:[] },
    ]},
  ],
  MindSocial: [
    { name: 'Scharfe Zunge', levels: [
      { lvl:'I', req:'Mind 8', effect:'+2 PW on Creativity+Cool rolls (Persuasion)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+4 PW', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'+6 PW', mods:[] },
      { lvl:'IV', req:'Mind 20', effect:'+8 PW. Persuasion under time pressure has no malus.', mods:[] },
      { lvl:'V', req:'Mind 24', effect:'+10 PW. Can convince NPCs with one line on a very high roll (GM call).', mods:[] },
    ]},
    { name: 'Eiserne Nerven', levels: [
      { lvl:'I', req:'Mind 8', effect:'+2 PW on Will+Cool rolls (Intimidation)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+4 PW. Also works on groups (10m).', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'+6 PW. Intimidate as secondary action.', mods:[] },
      { lvl:'IV', req:'Mind 22', effect:'+8 PW. Success vs a single target: they won’t attack this character this round.', mods:[] },
    ]},
    { name: 'Menschenkenntnis', levels: [
      { lvl:'I', req:'Mind 8', effect:'+3 PW on Focus+Senses rolls (spot lies, read motives)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+6 PW. Can gauge motivation after a short talk (GM hint).', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'+9 PW. Auto-spots undercover agents and disguises.', mods:[] },
    ]},
    { name: 'Street Cred', levels: [
      { lvl:'I', req:'Mind 8', effect:'Known locally. 10% discount. Simple info free.', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'Known city-wide. Black market access. Can put out rumors.', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'Respected by several factions. 1x/session: call in a favor.', mods:[] },
      { lvl:'IV', req:'Mind 20', effect:'Legend. First attacks vs this character: -4 PW. Corporate contacts.', mods:[] },
      { lvl:'V', req:'Mind 24', effect:'Living legend. 1x/session: resolve a situation through reputation alone (GM call).', mods:[] },
    ]},
    { name: 'Systemanalyst', levels: [
      { lvl:'I', req:'Mind 8', effect:'+2 PW on all Intelligence-based checks', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+4 PW', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'+6 PW. After a round of observation: identify a weakness (+2 PW for the party vs that enemy).', mods:[] },
      { lvl:'IV', req:'Mind 20', effect:'+8 PW. Analysis is instant, bonus rises to +4 PW.', mods:[] },
    ]},
    { name: 'Technikverstaendnis', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can repair weapons/vehicles/devices (Int roll). +3 PW on tech checks.', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+6 PW. Can install simple cyberware yourself.', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'+9 PW. Can modify military equipment. Can craft attachments yourself.', mods:[] },
    ]},
    { name: 'Feldmedizin', levels: [
      { lvl:'I', req:'Mind 8', effect:'Neutral main action: heal 1d6+2 HP (self or target)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'2d6+3 HP. Can stop Bleed effects.', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'2d6+6 HP. Can stabilize Mortally Wounded.', mods:[] },
      { lvl:'IV', req:'Mind 20', effect:'3d6+8 HP. Stabilizing as secondary action.', mods:[] },
      { lvl:'V', req:'Mind 24', effect:'3d6+12 HP. 1x/fight: bring a 0-HP target straight to 10% Max HP.', mods:[] },
    ]},
    { name: 'Taktischer Ueberblick', levels: [
      { lvl:'I', req:'Mind 10', effect:'Neutral main action: one ally gets +4 PW on their next action', mods:[], rallyBonus:{pw:4, rounds:1} },
      { lvl:'II', req:'Mind 15', effect:'Two allies. Buff lasts 2 rounds.', mods:[], rallyBonus:{pw:4, rounds:2} },
      { lvl:'III', req:'Mind 20', effect:'All allies in sight, +6 PW. Usable as secondary action.', mods:[], rallyBonus:{pw:6, rounds:2} },
    ]},
    { name: 'Kaltbluetig', levels: [
      { lvl:'I', req:'Mind 10', effect:'No Seriously Wounded malus on Mind rolls', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'No malus on any roll. Can still take Mind actions at 0 HP.', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'While Seriously Wounded or outnumbered 3:1: +3 PW on all rolls', mods:[] },
    ]},
    { name: 'Maskenspiel', levels: [
      { lvl:'I', req:'Mind 8', effect:'+4 PW on disguise/deception rolls', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+8 PW. Hold a role under pressure with no extra roll.', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'+10 PW. Can teach allies a role (+4 on their deception rolls).', mods:[] },
    ]},
    { name: 'Kampfstimulanzien', levels: [
      { lvl:'I', req:'Mind 10', effect:'Can craft stims: +4 on next roll, or +5 temp HP (2 rounds)', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'Stims: +8 roll or +10 temp HP. Can craft antidotes.', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'Can craft combat drugs: extra Flink, Pain Editor effect, or +4 Reflexes for 3 rounds', mods:[] },
    ]},
    { name: 'Schnelle Auffassung', levels: [
      { lvl:'I', req:'Mind 8', effect:'+3 on Initiative roll', mods:[{appliesTo:'initiative',amount:3,conditional:false}] },
      { lvl:'II', req:'Mind 12', effect:'+6 Initiative. Can no longer lose actions to surprise.', mods:[{appliesTo:'initiative',amount:6,conditional:false}] },
      { lvl:'III', req:'Mind 18', effect:'+9 Initiative. 1x/fight: ignore turn order and act immediately.', mods:[{appliesTo:'initiative',amount:9,conditional:false}], usesPerFight:1 },
    ]},
  ],
  General: [
    { name: 'Armor Breaker', levels: [
      { lvl:'I', req:'Power 10', effect:'-2 Temporary SP per hit (instead of -1). Applies to melee, ranged, and Combat Hacks.', mods:[{appliesTo:'armorAblation',scope:'all',amount:1,conditional:false}] },
      { lvl:'II', req:'Power 14', effect:'-3 Temporary SP per hit', mods:[{appliesTo:'armorAblation',scope:'all',amount:2,conditional:false}] },
      { lvl:'III', req:'Power 20', effect:'-4 Temporary SP per hit. Crit Success ablates Base SP directly (not automated — permanent-SP crit clause needs a manual base-SP edit).', mods:[{appliesTo:'armorAblation',scope:'all',amount:3,conditional:false}] },
    ]},
    { name: 'Kampferfahrung', levels: [
      { lvl:'I', req:'Power 8', effect:'+1 on all attack rolls', mods:[{appliesTo:'pw',scope:'all',amount:1,conditional:false}] },
      { lvl:'II', req:'Power 12', effect:'+2 on all attack rolls', mods:[{appliesTo:'pw',scope:'all',amount:2,conditional:false}] },
      { lvl:'III', req:'Power 16', effect:'+3 on all attack rolls', mods:[{appliesTo:'pw',scope:'all',amount:3,conditional:false}] },
      { lvl:'IV', req:'Power 20', effect:'+3 attack. +2 on all reaction rolls.', mods:[{appliesTo:'pw',scope:'all',amount:3,conditional:false},{appliesTo:'reaction',amount:2,conditional:false}] },
      { lvl:'V', req:'Power 24', effect:'+4 attack, +3 reaction. Crit Fail no longer triggers a catastrophic effect.', mods:[{appliesTo:'pw',scope:'all',amount:4,conditional:false},{appliesTo:'reaction',amount:3,conditional:false}] },
    ]},
    { name: 'Zaeher Ueberlebender', levels: [
      { lvl:'I', req:'Power 8', effect:'+5 Max HP', mods:[], maxBonus:{stat:'hp', amount:5} },
      { lvl:'II', req:'Power 12', effect:'+10 Max HP', mods:[], maxBonus:{stat:'hp', amount:10} },
      { lvl:'III', req:'Power 16', effect:'+15 Max HP. Regenerates 1 HP/round outside combat.', mods:[], maxBonus:{stat:'hp', amount:15} },
      { lvl:'IV', req:'Power 20', effect:'+20 Max HP. Regenerates 2 HP/round outside combat.', mods:[], maxBonus:{stat:'hp', amount:20} },
    ]},
    { name: 'Erste Hilfe', levels: [
      { lvl:'I', req:'Mind 8', effect:'Outside combat: heal 2d6 HP with a med-kit (secondary action)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'Also in combat as a neutral main action. Stabilizes allies at 0 HP.', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'Heals 3d6. Can remove critical status effects outside combat.', mods:[] },
    ]},
    { name: 'Stressresistenz', levels: [
      { lvl:'I', req:'Mind 8', effect:'+3 on Will rolls vs intimidation/fear', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+6. Cannot be forced into actions via social combat.', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'+9. Immune to Cyberpsychosis triggers from outside manipulation.', mods:[] },
    ]},
    { name: 'Beschleunigt', levels: [
      { lvl:'I', req:'Mobility 16', effect:'Flink usable 1x/fight', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 22', effect:'2x/fight', mods:[], usesPerFight:2 },
      { lvl:'III', req:'Mobility 26', effect:'3x/fight. Second-Flink-attack RW malus on the enemy goes away.', mods:[], usesPerFight:3 },
    ]},
    { name: 'Flink-Meister', levels: [
      { lvl:'I', req:'Mobility 15', effect:'Defensive Flink announceable even after the result is known (true last-second block)', mods:[] },
      { lvl:'II', req:'Mobility 20', effect:'Offensive Flink announceable after the result roll (see if the first attack hits first)', mods:[] },
    ]},
    { name: 'Reflexkette', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Defensive Flink: +4 PW on the defense roll', mods:[{appliesTo:'reaction',amount:4,conditional:true,label:'Defensive Flink (dodge)'}] },
      { lvl:'II', req:'Mobility 20', effect:'+6 PW. After a successful defensive Flink: free counter-attack at half PW.', mods:[{appliesTo:'reaction',amount:6,conditional:true,label:'Defensive Flink (dodge)'}] },
    ]},
    { name: 'Fahrzeugfuehrer', levels: [
      { lvl:'I', req:'Mobility 8', effect:'Handle a vehicle under stress with no roll. Chases: +3.', mods:[] },
      { lvl:'II', req:'Mobility 12', effect:'+6. Can use the vehicle as a weapon (Strength+Drive, like Heavy Melee).', mods:[] },
      { lvl:'III', req:'Mobility 16', effect:'+9. Can shoot/hack from the vehicle with no movement malus.', mods:[] },
      { lvl:'IV', req:'Mobility 20', effect:'+12. Stunts auto-succeed. No malus without visibility.', mods:[] },
    ]},
    { name: 'Pilot', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can pilot drones. +4 on pilot rolls.', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'+8. Combat drone gets its own action/round (Int+Focus attack).', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'+12. Drone acts independently. Can run 2 drones at once.', mods:[] },
    ]},
  ],
  Drone: [
    { name: 'GREMLIN-Upgrade', levels: [
      { lvl:'I', req:'Pilot 2', effect:'Drone gets its own action/round (Int+Focus as PW). Base range 20m.', mods:[] },
      { lvl:'II', req:'Pilot 5', effect:'+4 on all drone PW. Range 40m. Drone auto-survives 1 hit/fight.', mods:[{appliesTo:'pw',scope:'all',amount:4,conditional:false}] },
      { lvl:'III', req:'Pilot 10', effect:'+8 on all drone PW. Range 60m. Acts independently if operator is unconscious.', mods:[{appliesTo:'pw',scope:'all',amount:8,conditional:false}] },
    ]},
    { name: 'Medizin-Protokoll', levels: [
      { lvl:'I', req:'GREMLIN I, Mind 8', effect:'Drone heals 2d6 HP on an ally in range (operator secondary action). 1 charge/fight.', mods:[], usesPerFight:1 },
      { lvl:'II', req:'GREMLIN II, Mind 12', effect:'3d6 HP, 2 charges/fight. Can stabilize Seriously Wounded automatically.', mods:[], usesPerFight:2 },
      { lvl:'III', req:'GREMLIN III, Mind 16', effect:'4d6 HP, 3 charges/fight. Can quick-fix Critical Injuries with no roll (1x/fight).', mods:[], usesPerFight:3 },
    ]},
    { name: 'Revitalisierungs-Protokoll', levels: [
      { lvl:'I', req:'Medizin-Protokoll I', effect:'Drone stabilizes a Mortally Wounded target in range (main action, 1x/fight), no roll needed', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Medizin-Protokoll II', effect:'2x/fight. Target returns at 1 HP and is NOT unconscious.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Feld-Chirurg', levels: [
      { lvl:'I', req:'Medizin-Protokoll I', effect:'All healing actions (drone + manual) give +4 extra HP', mods:[] },
      { lvl:'II', req:'Medizin-Protokoll II', effect:'+8 extra HP. Healing auto-removes Bleed/Poison.', mods:[] },
    ]},
    { name: 'Kampf-Protokoll', levels: [
      { lvl:'I', req:'GREMLIN I, Mind 8', effect:'Secondary action: drone deals +7 damage (ignores SP), +11 vs cyberware/machines. 2x/fight.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'GREMLIN II, Mind 12', effect:'+11 damage (+18 vs machines). Target: Cyberware Malfunction. 3x/fight.', mods:[], usesPerFight:3 },
      { lvl:'III', req:'GREMLIN III, Mind 18', effect:'+18 damage (+25 vs machines). 2 cyberware items disabled for 2 rounds. No fight limit.', mods:[] },
    ]},
    { name: 'Kapazitaets-Entladung', levels: [
      { lvl:'I', req:'Kampf-Protokoll I', effect:'Drone: +7 damage to all in 5m radius (+11 vs machines/cyberware). 1x/fight.', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Kampf-Protokoll II', effect:'+11 damage in the area. Machines Stunned 1 round. 2x/fight.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Haywire-Protokoll', levels: [
      { lvl:'I', req:'GREMLIN I, Mind 10', effect:'Drone hacks an enemy drone/turret in range: Int+Focus vs Firewall. Success: disabled 2 rounds. 1x/fight.', mods:[], usesPerFight:1 },
      { lvl:'II', req:'GREMLIN II, Mind 16', effect:'Full control on success for rest of fight — machine fights as an ally. 2x/fight.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Vollstaendige Uebernahme', levels: [
      { lvl:'I', req:'Haywire-Protokoll II', effect:'1x/mission: drone attempts to permanently take over a machine. Int+Focus vs Firewall+6. Success: becomes a permanent NPC ally.', mods:[] },
    ]},
    { name: 'Hilfs-Protokoll', levels: [
      { lvl:'I', req:'GREMLIN I', effect:'Drone escorts a target: +3 PW on their next attack (secondary action, 2x/fight)', mods:[], usesPerFight:2 },
      { lvl:'II', req:'GREMLIN II, Mind 12', effect:'+5 PW. Target also gets an automatic Covering Fire reaction shot.', mods:[], usesPerFight:2 },
      { lvl:'III', req:'GREMLIN III, Mind 16', effect:'Drone auto-follows a designated ally. Passive +2 PW on all their attacks.', mods:[] },
    ]},
    { name: 'Bedrohungsanalyse', levels: [
      { lvl:'I', req:'Hilfs-Protokoll I', effect:'Main action: target gets Covering Fire on the first enemy who attacks them. 2x/fight.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'Hilfs-Protokoll II', effect:'3x/fight. Target gets 2 reaction shots. Reaction shots can crit.', mods:[], usesPerFight:3 },
    ]},
    { name: 'Bereichs-Scanner', levels: [
      { lvl:'I', req:'GREMLIN I', effect:'Drone scans 20m radius: hidden/invisible targets revealed for 1 round (even stealthed). 2x/fight.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'GREMLIN II, Mind 14', effect:'40m radius, 2-round scan. Revealed enemies: -4 PW (drone panic). 3x/fight.', mods:[], usesPerFight:3 },
    ]},
    { name: 'Sentinel', levels: [
      { lvl:'I', req:'Mind 10, Pilot 2', effect:'Reaction roll usable twice per round instead of once. Second: -4 PW.', mods:[] },
      { lvl:'II', req:'Mind 16, Pilot 5', effect:'Second reaction roll: no malus. Both can crit.', mods:[] },
    ]},
    { name: 'Ewige Wachsamkeit', levels: [
      { lvl:'I', req:'Sentinel I', effect:'A round with only movement (no attack/hack): free reaction shot at round’s end', mods:[] },
    ]},
  ],
  Heavy: [
    { name: 'Gauntlet-Training', levels: [
      { lvl:'I', req:'Power 8', effect:'Flamethrower: 2 charges/fight. Rocket Launcher: 1 charge/fight. PW: Focus+Strength.', mods:[] },
      { lvl:'II', req:'Power 12', effect:'Flamethrower: 3 charges. Rockets: 2 charges. +3 on all Heavy Weapons PW.', mods:[{appliesTo:'pw',scope:'ranged',amount:3,conditional:false}] },
      { lvl:'III', req:'Power 16', effect:'4 flamethrower / 3 rocket charges. +6 PW. Both reloadable between fights.', mods:[{appliesTo:'pw',scope:'ranged',amount:6,conditional:false}] },
    ]},
    { name: 'Zielgenauigkeit', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'Max rocket deviation halved. +4 PW on Rocket Launcher.', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:true}] },
      { lvl:'II', req:'Gauntlet II', effect:'+8 PW. Rocket rolls can now crit.', mods:[{appliesTo:'pw',scope:'ranged',amount:8,conditional:true}] },
      { lvl:'III', req:'Gauntlet III', effect:'+12 PW. Precision rocket: aimed shot on a single target with no AoE.', mods:[{appliesTo:'pw',scope:'ranged',amount:12,conditional:true}] },
    ]},
    { name: 'Napalm-X', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'Flamethrower hits that don’t ignite: Will+Grit DV 12 or disoriented (-2 all actions, 1 round)', mods:[] },
      { lvl:'II', req:'Gauntlet II', effect:'DV 10. Crit Success: panic (target flees, no attacks, 1 round).', mods:[] },
    ]},
    { name: 'Incinerator', levels: [
      { lvl:'I', req:'Gauntlet I, Napalm-X I', effect:'Flame cone: +2m range and +2m width', mods:[] },
      { lvl:'II', req:'Gauntlet II, Napalm-X II', effect:'Cone +2m again in every direction. Firewall lingers 1 round, damages anyone entering.', mods:[] },
    ]},
    { name: 'Feuersturm', levels: [
      { lvl:'I', req:'Incinerator I', effect:'1x/fight: 360-degree flamethrower hit on ALL targets in 5m. Full damage to all. Costs 2 charges. Immune to fire rest of fight.', mods:[], usesPerFight:1 },
    ]},
    { name: 'Ausbrenneffekt', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'After each flamethrower use: 2m smoke screen around operator for 1 round (+4 PW on reaction rolls)', mods:[{appliesTo:'reaction',amount:4,conditional:true,label:'In own smoke screen'}] },
      { lvl:'II', req:'Gauntlet II', effect:'+6 PW from smoke. Lasts 2 rounds, expands to 4m.', mods:[{appliesTo:'reaction',amount:6,conditional:true,label:'In own smoke screen'}] },
    ]},
    { name: 'Schnellentladung', levels: [
      { lvl:'I', req:'Gauntlet II, Ausbrenneffekt I', effect:'1x/fight: next flamethrower use costs a secondary action instead of main', mods:[], usesPerFight:1 },
    ]},
    { name: 'Groesste Explosion', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'50% chance: grenades/rockets deal +3 damage', mods:[] },
      { lvl:'II', req:'Gauntlet II', effect:'Guaranteed +3 damage on all explosions, no roll', mods:[] },
    ]},
    { name: 'Tandem-Sprengkoepfe', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'Explosion hitting 2+ targets: each takes +3 extra damage', mods:[] },
      { lvl:'II', req:'Gauntlet II', effect:'3+ targets: +6 extra. No damage falloff at blast edge.', mods:[] },
    ]},
    { name: 'Bunker-Brecher', levels: [
      { lvl:'I', req:'Gauntlet II, Zielgenauigkeit I', effect:'1x/fight: rocket does x3 damage to cover (HP), destroys even Thick Steel. Only half explosive damage vs people.', mods:[], usesPerFight:1 },
    ]},
    { name: 'Phosphor-Munition', levels: [
      { lvl:'I', req:'Gauntlet I', effect:'Flamethrower can now damage machines/robots. Every hit also reduces target SP by 2.', mods:[] },
    ]},
    { name: 'Ruestungsbrecher (Heavy)', levels: [
      { lvl:'I', req:'Power 10', effect:'Primary-weapon hit: target SP -1 permanently (max -3/fight) — not automated, this reduces BASE SP with a per-fight cap, unlike the auto-ablation on Temporary SP', mods:[] },
      { lvl:'II', req:'Power 15', effect:'SP -2 per hit (max -6/fight). Applies to explosions too.', mods:[] },
      { lvl:'III', req:'Power 20', effect:'SP -3 per hit, no max. Target at 0 SP: all attacks vs it count as unarmored.', mods:[] },
    ]},
    { name: 'Taktisches Gespuer', levels: [
      { lvl:'I', req:'Mind 8', effect:'+3 PW on your own reaction rolls per visible enemy (max +9 at 3 enemies)', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'+4/enemy (max +12). Also applies vs ranged attacks.', mods:[] },
      { lvl:'III', req:'Mind 18', effect:'+5/enemy (max +15). First attack vs this character per fight auto-misses if 3+ enemies visible.', mods:[] },
    ]},
    { name: 'Unbeugsamkeit', levels: [
      { lvl:'I', req:'Power 8', effect:'+5 Max HP. Explosion/grenade damage taken: -3 (min 1).', mods:[], maxBonus:{stat:'hp', amount:5} },
      { lvl:'II', req:'Power 14', effect:'+10 Max HP. Explosion damage -6. No knockback from explosions.', mods:[], maxBonus:{stat:'hp', amount:10} },
    ]},
    { name: 'Javelin-Raketen', levels: [
      { lvl:'I', req:'Gauntlet I, Zielgenauigkeit I', effect:'Rocket Launcher effective/max range both +50% — 150m/450m instead of the base 100m/300m (§6.4a). Can hit targets outside your own sightline if an ally has sight (Squadsight).', mods:[] },
      { lvl:'II', req:'Gauntlet II, Zielgenauigkeit II', effect:'Both range values double instead — 200m/600m. No distance-based PW halving inside that extended maximum range.', mods:[] },
    ]},
  ],
  Tactician: [
    { name: 'Holo-Markierung', levels: [
      { lvl:'I', req:'Mind 8', effect:'Secondary action: mark a visible target. All allies: +4 PW vs it for 2 rounds. 3x/fight.', mods:[], usesPerFight:3, markBonus:{pw:4, wb:0, rounds:2} },
      { lvl:'II', req:'Mind 12', effect:'+6 PW for allies. Also +2 Weapon Bonus on the first hit vs the marked target. 4x/fight.', mods:[], usesPerFight:4, markBonus:{pw:6, wb:2, rounds:2} },
      { lvl:'III', req:'Mind 16', effect:'+8 PW and +3 WB. Marking lasts 3 rounds. No fight limit anymore.', mods:[], markBonus:{pw:8, wb:3, rounds:3} },
    ]},
    { name: 'Multi-Markierung', levels: [
      { lvl:'I', req:'Holo-Markierung II', effect:'Holo-Markierung hits up to 3 targets in a 5m radius at once (one action). 2x/fight.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'Holo-Markierung III', effect:'Up to 5 targets in an 8m radius. No fight limit. All Holo-Markierung bonuses apply.', mods:[] },
    ]},
    { name: 'Deckungsfeuer', levels: [
      { lvl:'I', req:'Mind 10', effect:'Feuerbereitschaft can also trigger when an enemy in the watched area starts an attack, hack, grenade throw, or other visible main action, not just movement. Resolves before that action.', mods:[] },
      { lvl:'II', req:'Mind 16', effect:'Feuerbereitschaft no longer ends after its first reaction shot — it can trigger up to two matching reaction shots before your next turn. Both use full PW and their own normal Stamina/ammo cost.', mods:[] },
    ]},
    { name: 'Blitzreflexe', levels: [
      { lvl:'I', req:'Mobility 10', effect:'The first reaction/overwatch shot per round vs this character always misses — no roll', mods:[] },
      { lvl:'II', req:'Mobility 16', effect:'The first TWO reaction shots per round vs this character always miss', mods:[] },
    ]},
    { name: 'Rennen und Schiessen', levels: [
      { lvl:'I', req:'Mobility 10', effect:'1x/fight: full movement + ranged attack as one main action, no movement malus', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 16', effect:'3x/fight. Also works for melee.', mods:[], usesPerFight:3 },
    ]},
    { name: 'Phantom', levels: [
      { lvl:'I', req:'Mobility 16, Schleichen II', effect:'If allies are spotted or a fight starts: this character auto-stays in stealth until they attack or move', mods:[] },
    ]},
    { name: 'Schattenangriff', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Attacks from stealth: +6 PW extra. First die 1-2 = Crit (instead of just 1).', mods:[{appliesTo:'pw',scope:'all',amount:6,conditional:true}] },
      { lvl:'II', req:'Mobility 18', effect:'+10 PW from stealth. First die 1-3 = Crit. Crit from stealth: target gets no reaction roll.', mods:[{appliesTo:'pw',scope:'all',amount:10,conditional:true}] },
    ]},
    { name: 'Aggression', levels: [
      { lvl:'I', req:'Power 10', effect:'First die 1-2 = Crit Success (instead of just 1) if 2+ enemies are visible', mods:[] },
      { lvl:'II', req:'Power 14', effect:'1-3 = Crit if 3+ enemies visible. Crit damage: +4 extra.', mods:[] },
      { lvl:'III', req:'Power 20', effect:'1-4 = Crit if 4+ enemies visible. Crit damage +7 extra.', mods:[] },
    ]},
    { name: 'Unaufhaltsam', levels: [
      { lvl:'I', req:'Mobility 10', effect:'1x/round: a kill returns this character’s movement action', mods:[] },
      { lvl:'II', req:'Mobility 16', effect:'2x/round. A Technique kill also returns movement.', mods:[] },
    ]},
    { name: 'Kettenreaktion', levels: [
      { lvl:'I', req:'Mobility 15', effect:'1x/fight: a ranged kill returns a main action — attack again immediately', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 20', effect:'2x/fight. Also works for melee kills.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Tod von oben', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Kill from an elevated position (2m+ higher): +4 Weapon Bonus', mods:[{appliesTo:'wb',scope:'all',amount:4,conditional:true}] },
      { lvl:'II', req:'Mobility 16', effect:'+7 WB from height. Kill also returns movement action. Height bonus now applies from 1m up.', mods:[{appliesTo:'wb',scope:'all',amount:7,conditional:true}] },
    ]},
    { name: 'Schnellfeuer', levels: [
      { lvl:'I', req:'Mobility 15', effect:'1x/fight: two ranged attacks as one main action, both at -5 PW', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 20', effect:'2x/fight. Second shot benefits from PW bonuses on the first (e.g. Holo-Markierung).', mods:[], usesPerFight:2 },
    ]},
    { name: 'Beruehigungsfeuer', levels: [
      { lvl:'I', req:'Mind 10', effect:'Suppressive Fire zone 15m wide (instead of 10m). Suppressed targets: extra -3 PW.', mods:[] },
      { lvl:'II', req:'Mind 16', effect:'Zone 25m wide. Suppressed targets who move: +25% damage from reaction shot.', mods:[] },
    ]},
    { name: 'Killzone', levels: [
      { lvl:'I', req:'Mind 14', effect:'1x/fight: main action, active until the start of your next turn. Any enemy moving through the chosen 90-degree cone triggers a reaction shot (no additional trigger roll needed — the target still gets its normal defensive reaction), resolved before the movement continues. Each enemy can only trigger it once during that duration.', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mind 20', effect:'2x/fight. 180-degree cone. Killzone reaction shots can crit.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Stabiler Schuss', levels: [
      { lvl:'I', req:'Mind 8', effect:'If this character hasn’t moved this round: +4 PW on the first attack', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:true}] },
      { lvl:'II', req:'Mind 14', effect:'+4 PW on ALL attacks this round if stationary. +3 Weapon Bonus on Aimed Shots.', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:true},{appliesTo:'wb',scope:'ranged',amount:3,conditional:true}] },
    ]},
    { name: 'Praeziser Todesschuss', levels: [
      { lvl:'I', req:'Mind 16, Stabiler Schuss I', effect:'+4 Weapon Bonus on all ranged attacks. Crit damage +2 extra.', mods:[{appliesTo:'wb',scope:'ranged',amount:4,conditional:false}] },
      { lvl:'II', req:'Mind 22, Stabiler Schuss II', effect:'+7 Weapon Bonus. Crit damage +4. Aimed Shots no longer have a PW malus.', mods:[{appliesTo:'wb',scope:'ranged',amount:7,conditional:false}] },
    ]},
    { name: 'Nah und persoenlich', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Ranged attack on a target under 4m: first die 1-3 = Crit (instead of just 1)', mods:[] },
      { lvl:'II', req:'Mobility 18', effect:'First die 1-4 = Crit under 4m. No melee-range malus on ranged weapons.', mods:[] },
    ]},
  ],
  Sniper: [
    { name: 'Holo-Zielfernrohr', levels: [
      { lvl:'I', req:'Mobility 8', effect:'Secondary action: mark a target in Sniper range. Team: +4 PW + +2 Weapon Bonus vs it for 2 rounds.', mods:[], markBonus:{pw:4, wb:2, rounds:2} },
      { lvl:'II', req:'Mobility 12', effect:'+6 PW + +3 WB. Marking lasts 3 rounds. No cooldown every 3 rounds anymore.', mods:[], markBonus:{pw:6, wb:3, rounds:3} },
      { lvl:'III', req:'Mobility 18', effect:'+8 PW + +4 WB. No cooldown at all. Passive: every visible target is always marked +2 PW for the team.', mods:[], markBonus:{pw:8, wb:4, rounds:-1} },
    ]},
    { name: 'Vitalpoint-Analyse', levels: [
      { lvl:'I', req:'Holo-Zielfernrohr I', effect:'After marking a target: next Aimed Shot on it has no PW malus + Crit threshold at 1-2', mods:[] },
      { lvl:'II', req:'Holo-Zielfernrohr II', effect:'Next 2 Aimed Shots, no malus + Crit 1-3. Also grants +3 Weapon Bonus.', mods:[] },
    ]},
    { name: 'Toedlicher Schuss', levels: [
      { lvl:'I', req:'Holo-Zielfernrohr II, Mobility 16', effect:'1x/fight: Sniper Aimed Shot with a guaranteed Crit Success (no roll) if the target is marked', mods:[], usesPerFight:1 },
      { lvl:'II', req:'Mobility 22', effect:'2x/fight. Works even without a mark. Ignores target’s entire SP.', mods:[], usesPerFight:2 },
    ]},
    { name: 'Serientoeter', levels: [
      { lvl:'I', req:'Mobility 14', effect:'Sniper kill: next Sniper shot this round costs 0 Stamina. 2x/fight.', mods:[], usesPerFight:2 },
      { lvl:'II', req:'Mobility 22', effect:'No limit — the chain can run forever as long as kills keep coming', mods:[] },
    ]},
    { name: 'Schnappschuss', levels: [
      { lvl:'I', req:'Mobility 12', effect:'Sniper attack after moving: only -3 PW (instead of the normal movement malus). Once per round.', mods:[] },
      { lvl:'II', req:'Mobility 18', effect:'No PW malus at all on a Sniper attack after moving', mods:[] },
    ]},
    { name: 'Jaegers Instinkt', levels: [
      { lvl:'I', req:'Mobility 10', effect:'vs targets under 50% HP: +4 PW and +2 Weapon Bonus', mods:[{appliesTo:'pw',scope:'ranged',amount:4,conditional:true},{appliesTo:'wb',scope:'ranged',amount:2,conditional:true}] },
      { lvl:'II', req:'Mobility 16', effect:'vs targets under 25% HP: +8 PW and +4 WB. Crit threshold at 1-3.', mods:[{appliesTo:'pw',scope:'ranged',amount:8,conditional:true},{appliesTo:'wb',scope:'ranged',amount:4,conditional:true}] },
    ]},
    { name: 'Fernbeobachtung', levels: [
      { lvl:'I', req:'Holo-Zielfernrohr I, Mind 12', effect:'Sniper’s reaction roll can target anything an ally can see (not just what you see yourself), with no range malus', mods:[] },
    ]},
  ],
  // Medic and Tech-Operator talents are almost entirely healing amounts,
  // crafting/economy mechanics, and other non-combat effects with no
  // corresponding roll anywhere in this app (no "roll to repair a
  // vehicle" button exists, etc.) — reference-only, same treatment as
  // hack combos. Still fully cataloged so the picker covers every talent
  // in the book, not just the combat-PW ones.
  Medic: [
    { name: 'First Aid', levels: [
      { lvl:'I', req:'Mind 8', effect:'Heals 1d6+3 HP per treatment. Action: one round, target in range (2m).', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'Heals 1d6+5 HP. After 10 min stabilization: treatment as secondary action.', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'Heals 1d6+7 HP. 1x/fight treatment as secondary action.', mods:[] },
      { lvl:'IV', req:'Mind 20', effect:'Heals 1d6+9 HP. Two targets per fight. Auto-stabilizes negative-HP targets.', mods:[] },
    ]},
    { name: 'Chirurg', levels: [
      { lvl:'I', req:'Mind 10', effect:'Can treat light Critical Injuries (Broken Ribs, Foreign Object, Damaged Eye) — 1h + right gear', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'All physical CIs treatable. Can work during combat lulls. No Ripperdoc contact needed.', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'Cyberware CIs treatable (permanently fix Cyberware Malfunction). Ripperdoc-level.', mods:[] },
    ]},
    { name: 'Trauma-Spezialist', levels: [
      { lvl:'I', req:'Mind 10', effect:'Healing rolls in combat unaffected by movement malus. First Aid usable on self as secondary action.', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'Adrenaline shot: bring an unconscious ally back at 1 HP (1x/day, uses a trauma kit)', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'Target can act immediately after being healed. Combat-Medic: +2 PW on all Medic actions in combat.', mods:[] },
    ]},
    { name: 'Pharma-Kenntnis', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can craft basic stims (+2 stat for one scene, ~100 ed material). Can identify mild poisons/drugs.', mods:[] },
      { lvl:'II', req:'Mind 12', effect:'Advanced stims (+3 stat, or +1 to two stats). Antidotes for mild poisons.', mods:[] },
      { lvl:'III', req:'Mind 16', effect:'Combat stims (+1 attack/round for 3 rounds). Can neutralize strong poisons. Designer drugs from blueprint.', mods:[] },
    ]},
    { name: 'Empathische Therapie', levels: [
      { lvl:'I', req:'Mind 10', effect:'Emotional stabilization: Humanity+Cool vs DV 15. Success: target +1 Humanity (up to max). 1x/scene per target.', mods:[] },
      { lvl:'II', req:'Mind 14', effect:'+4 PW on Humanity-stabilization rolls. Can run a standard therapy session (normally 500 ed, 1 week) in 3 free sessions.', mods:[] },
      { lvl:'III', req:'Mind 20', effect:'+5 PW on all Humanity rolls. 1x/arc: intensive integration therapy with no material cost.', mods:[] },
    ]},
  ],
  TechOperator: [
    { name: 'Tech-Operator', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can print Average Quality. Knows all Public/Restricted blueprints for free. Print time -25%.', mods:[] },
      { lvl:'II', req:'Mind 12, Tech-Op I', effect:'Can print Excellent Quality. Can reverse-engineer blueprints (Int+Focus, DV 12-20). Can print integrated-suppressor weapons (no attachment slot used).', mods:[] },
      { lvl:'III', req:'Mind 16, Tech-Op II', effect:'Can print simple cyberware (Poor Quality, HL +50%, install DV +3). Can integrate 2 mods into a printed weapon. Can reverse-engineer Classified blueprints.', mods:[] },
    ]},
    { name: 'Tinker', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can attach/remove an attachment mod (1h, toolkit). No weaponsmith needed.', mods:[] },
      { lvl:'II', req:'Mind 12, Tinker I', effect:'Can craft improvised mods (+1 WB or a simple effect, Poor Quality). Can permanently integrate a melee mod.', mods:[] },
      { lvl:'III', req:'Mind 16, Tinker II', effect:'Can combine two weapons into one (each loses 1 attachment slot, gains primary+secondary function). GM sets the physical limits.', mods:[] },
    ]},
    { name: 'Feldreparatur', levels: [
      { lvl:'I', req:'Mind 8', effect:'Can repair any item to Poor Quality in 10 min. Only needs a toolkit (50 ed).', mods:[] },
      { lvl:'II', req:'Mind 12, Feldreparatur I', effect:'Can repair to Average Quality. With a Portable Fab: Excellent Quality in 1h. Can quick-fix Critical Injuries with improvised means (+2 on the treatment roll).', mods:[] },
      { lvl:'III', req:'Mind 16, Feldreparatur II', effect:'Can temporarily reactivate cyberware in the field (24h, then needs a Ripperdoc). Can improvise functioning gadgets from scrap (GM sets function/DV).', mods:[] },
    ]},
    { name: 'Rueckentwicklung', levels: [
      { lvl:'I', req:'Mind 12, Tech-Op II', effect:'Disassemble an item (4h) to extract its blueprint. Int+Focus: DV 12 (Standard), 15 (Elite), 20 (Iconic). Failure destroys the item, no blueprint.', mods:[] },
      { lvl:'II', req:'Mind 18, Tech-Op III', effect:'No roll needed for Standard/Elite items. Iconic: DV 12, 50% chance the item survives.', mods:[] },
    ]},
    { name: 'Blueprint-Hacker', levels: [
      { lvl:'I', req:'Mind 12, Tech-Op I, Neural Link', effect:'Can hack Restricted blueprints out of networked fabricators (Int+Creativity, DV = system’s Firewall)', mods:[] },
      { lvl:'II', req:'Mind 18, Tech-Op II', effect:'Can steal Classified blueprints. Can crack blueprint copy-protection and redistribute them.', mods:[] },
    ]},
    { name: 'Ghost Print', levels: [
      { lvl:'I', req:'Mind 10, Tech-Op I', effect:'Printed items have no detectable polymer signature. Standard corpo scanners (DV 15-) find nothing.', mods:[] },
      { lvl:'II', req:'Mind 16, Tech-Op II', effect:'Even Milspec scanners fail. Effectively fully undetectable.', mods:[] },
    ]},
    { name: 'Material-Effizienz', levels: [
      { lvl:'I', req:'Mind 8, Tech-Op I', effect:'Print job material cost -40%. Can recycle destroyed items for 30% material value back.', mods:[] },
      { lvl:'II', req:'Mind 14, Tech-Op II', effect:'Material cost -70%. Any mechanical item usable as raw material (50% value). Repairs cost only 20% of retail.', mods:[] },
    ]},
    { name: 'Schnell-Fabrikation', levels: [
      { lvl:'I', req:'Mind 8, Tech-Op I', effect:'Print time -25% on top of Tech-Op I (combined: -50%)', mods:[] },
      { lvl:'II', req:'Mind 12, Tech-Op II', effect:'Small items (ammo, knives, gadgets) print in 15 minutes. Medium items -50% extra.', mods:[] },
      { lvl:'III', req:'Mind 16, Tech-Op III', effect:'Can print a weapon or simple gadget in a Short Rest (30 min) with a Portable Fab (Emergency Print)', mods:[] },
    ]},
    { name: 'Cyberware-Druck', levels: [
      { lvl:'I', req:'Mind 18, Tech-Op III', effect:'Can print simple cyberware (Neuralware up to Cap 4, external CW, Fashionware). Poor Quality: HL +50% vs Normal. Install DV +3. Needs a Standard Fab.', mods:[] },
      { lvl:'II', req:'Mind 24, CW-Druck I, Industrial Fab', effect:'Can print medium cyberware (Cyberlimbs, internal CW up to Cap 6). HL risk only +25%. Normal install DV. Average Quality possible.', mods:[] },
    ]},
  ],
} as const;

export const TECHNIQUE_CATALOG = {
  MeleeGeneric: [
    { name: 'Vernichtender Schlag', stamina:3, pw:{mode:'same'}, effect:'PW for this attack doubled. Once per 12h.' },
    { name: 'Durchbruch', stamina:4, pw:{mode:'same'}, effect:"Ignores the target's ENTIRE SP (not just half, as normal)." },
    { name: 'Staggering Strike', stamina:3, pw:{mode:'same'}, effect:'Hit: target loses their secondary action next round.', statusGrant:{type:'stagger', name:'Stagger (Staggering Strike)', rounds:1} },
    { name: 'Blutende Wunde', stamina:3, pw:{mode:'same'}, effect:'Hit: Bleed, 2 dmg/round until treated (First Aid DV 10).', statusGrant:{type:'bleed', name:'Bleed (Blutende Wunde)', rounds:-1} },
    { name: 'Ausweich-Konter', stamina:4, pw:{mode:'none'}, effect:'Reaction roll. After a successful dodge: immediate free counter-attack at normal PW. Extra action.' },
    { name: 'Ansturm', stamina:2, pw:{mode:'same'}, effect:'Move up to 8m extra before the attack with no movement malus on it.' },
    { name: 'Entwaeffnungs-Schlag', stamina:2, pw:{mode:'delta', amount:-2}, effect:"No damage. Hit: target's weapon drops." },
    { name: 'Einschuechternder Schlag', stamina:2, pw:{mode:'override', stats:['will','cool'], label:'Will+Cool'}, effect:"No damage. Target Will-rolls DV 12 or won't attack this character this round." },
    { name: 'Wurfangriff', stamina:3, pw:{mode:'override', stats:['dexterity','strength'], label:'Dex+Str'}, effect:'Throw the melee weapon up to 10m. Full weapon bonus. No half-SP benefit.' },
    { name: 'Kampfhaltung', stamina:2, pw:{mode:'none'}, effect:'No attack this action. Next defensive main action: +6 PW on Block or Parry.' },
    { name: 'Vitalpunkt-Suche', stamina:4, pw:{mode:'delta', amount:-4}, effect:"Aimed Shot to the head without the normal Aimed-Shot malus — just this technique's -4 PW instead." },
    { name: 'Rueckstoss', stamina:3, pw:{mode:'override', stats:['strength','grit'], label:'Str+Grit'}, effect:'No normal damage. Hit: target knocked back 1d6+2m. Wall impact: +11 damage.' },
    { name: 'Schildstoss', stamina:2, pw:{mode:'override', stats:['strength','grit'], label:'Str+Grit'}, effect:'No damage. Hit: target Staggered (loses secondary action) + pushed back 1m. Shield only.', statusGrant:{type:'stagger', name:'Staggered (Schildstoss)', rounds:1} },
  ],
  MeleeHeavy: [
    { name: 'Erderschuetterung', stamina:5, pw:{mode:'override', stats:['strength','grit'], label:'Str+Grit'}, effect:'Ground slam: all targets in 3m radius take normal damage. No Speed roll (DV 10): Prone.' },
    { name: 'Panzerbrecher', stamina:4, pw:{mode:'same'}, effect:"Hit permanently reduces target's SP by 4." },
    { name: 'Unaufhaltsam', stamina:5, pw:{mode:'same'}, effect:'This attack cannot be blocked or parried — only dodging works.' },
    { name: 'Breitschwung', stamina:3, pw:{mode:'delta', amount:0}, effect:'360-degree attack on all targets in range, one roll for all. First hit full PW, each further hit -3 PW cumulative.' },
    { name: 'Zermalmung', stamina:6, pw:{mode:'same'}, effect:'Double weapon bonus + ignores all SP. Charge: announce as secondary action this round, fire next round.' },
  ],
  MeleeLight: [
    { name: 'Blitzklinge', stamina:5, pw:{mode:'same'}, effect:'Attack as a secondary action instead of main. Once per round. Extra action.' },
    { name: 'Doppelstich', stamina:3, pw:{mode:'delta', amount:-3}, effect:'Two hits in one main action, full weapon bonus, -3 PW on both.' },
    { name: 'Schattenklinge', stamina:3, pw:{mode:'same'}, effect:'Attack from stealth: target gets no reaction roll. Position stays hidden after.' },
    { name: 'Monofilament-Schnitt', stamina:4, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'Mono-Filament Wire only: ignores SP entirely. Crit Success: severed-limb CI.' },
    { name: 'Tanzende Klinge', stamina:5, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'3 attacks in one main action, each at -50% PW. Target loses their reaction roll after the first hit.' },
  ],
  MeleeCyber: [
    { name: 'Klingenwirbel', stamina:5, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'360-degree whirl on all adjacent targets, one roll for all. Mantis Blades only.' },
    { name: 'Mantis-Sturzflug', stamina:4, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'Leap up to 6m onto a target: +6 Weapon Bonus, target Prone. Mantis Blades only.' },
    { name: 'Ripper-Kaskade', stamina:5, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi', amount:-2}, effect:'3 rapid hits on one target, each at full weapon bonus. Rippers only.' },
    { name: 'Gorilla-Ramme', stamina:4, pw:{mode:'override', stats:['strength','grit'], label:'Str+Grit'}, effect:'No weapon bonus — instead Strength x2 as damage. Ignores all SP. Gorilla Arm only.' },
    { name: 'Cyber-Stun', stamina:3, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'Hit: target loses their next main action (electro-neural stun). Requires Shock Element mod.', statusGrant:{type:'custom', name:'Stunned (Cyber-Stun) — loses next main action', rounds:1} },
  ],
  Brawling: [
    { name: 'Haymaker', stamina:4, pw:{mode:'override', stats:['dexterity','strength'], label:'Dex+Str', amount:-6}, effect:'Everything into one punch: Brawling damage x2, but -6 PW.' },
    { name: 'Takedown', stamina:4, pw:{mode:'override', stats:['dexterity','strength'], label:'Dex+Str'}, effect:'Hit immediately starts a Grapple — no separate grab action needed. Extra action.' },
    { name: 'Kopfstoss', stamina:2, pw:{mode:'override', stats:['dexterity','strength'], label:'Dex+Str', amount:4}, effect:'Surprise headbutt: +4 PW. Hit: target -2 on all actions next round.', statusGrant:{type:'custom', name:'Kopfstoss — -2 all actions', rounds:1} },
    { name: 'Beinhaken', stamina:2, pw:{mode:'override', stats:['dexterity','agility'], label:'Dex+Agi'}, effect:'No damage. Target Speed-rolls DV 12 or goes Prone.' },
    { name: 'Wuergegriff', stamina:4, pw:{mode:'override', stats:['strength','grit'], label:'Str+Grit'}, effect:'Requires an active Grapple. Damage = Strength x2 (instead of Strength). Ignores armor.' },
  ],
  RangedGeneric: [
    { name: 'Schneller Schuss', stamina:4, pw:{mode:'same'}, effect:'Fire first this round regardless of initiative order. Once per round. Extra action.' },
    { name: 'Praezisionsschuss', stamina:3, pw:{mode:'same'}, effect:'Aimed Shot to a body zone WITHOUT the normal -4 PW malus.' },
    { name: 'Konzentriertes Feuer', stamina:2, pw:{mode:'delta', amount:6}, effect:'+6 PW on this one shot. No other bonus active this round.' },
    { name: 'Kampf-Reload', stamina:4, pw:{mode:'none'}, effect:'Reload as a free action — no secondary-action cost. Once per round. Extra action.' },
    { name: 'Deckungsschuss', stamina:2, pw:{mode:'none'}, effect:"Firing from full cover: 1/2 PW (instead of the normal 1/4 Blindfire value)." },
    { name: 'Tarnschuss', stamina:3, pw:{mode:'same'}, effect:'Stealth holds after this shot, even without a Suppressor.' },
    { name: 'Berechneter Angriff', stamina:2, pw:{mode:'delta', amount:4}, effect:'Observe target as secondary action: +4 PW on the next attack vs it this round.' },
    { name: 'Durch die Deckung', stamina:3, pw:{mode:'delta', amount:-4}, effect:"Shot ignores the target's cover HP entirely." },
    { name: 'Smartlink-Burst', stamina:5, pw:{mode:'delta', amount:4}, effect:'Neural Link + Smartgun only: +4 PW + simultaneous Cyberware Malfunction (no IP cost). Extra action.', statusGrant:{type:'malfunction', name:'CW Malfunction (Smartlink-Burst)', rounds:3, stacks:1, maxStacks:3} },
  ],
  SMGAssault: [
    { name: 'Feuersturm', stamina:5, pw:{mode:'same'}, effect:'Autofire on 3 targets with no movement malus. Normal Autofire magazine cost.' },
    { name: 'Magazin-Leeren', stamina:4, pw:{mode:'same'}, effect:'Empty the rest of the magazine into one target: +18 Weapon Bonus extra. Needs 50%+ magazine. Reload required after.' },
    { name: 'Unterdrueckungsmeister', stamina:3, pw:{mode:'none'}, effect:"Suppressive Fire: target's Will-roll -6. Zone up to 10m wide." },
    { name: 'Kreuzfeuer', stamina:6, pw:{mode:'same'}, effect:'Autofire on two target groups at once, half PW each. Double magazine cost.' },
    { name: 'Sturmfeuer', stamina:4, pw:{mode:'delta', amount:-2}, effect:'4 single shots on the same target in one main action, each at full weapon bonus.' },
  ],
  Pistol: [
    { name: 'Blitzziehen', stamina:4, pw:{mode:'same'}, effect:'Draw and fire in one motion — part of the main action, no separate draw.' },
    { name: 'Doppelpistolen-Feuer', stamina:4, pw:{mode:'delta', amount:-3}, effect:'Two pistols on two targets at once, both full weapon bonus, -3 PW each.' },
    { name: 'Fan the Hammer', stamina:5, pw:{mode:'delta', amount:-3}, effect:"Fires every remaining round in the magazine at one target (min. 2 loaded). First shot full PW, each further -3 PW cumulative, full weapon bonus each. Reload required next action." },
    { name: 'Punto Banco', stamina:5, pw:{mode:'same'}, effect:'Fire on two targets in sequence in one main action. Second shot -4 PW. Extra action.' },
    { name: 'Execution Shot', stamina:6, pw:{mode:'override', stats:['focus','senses'], label:'Foc+Sen'}, effect:'Only vs a target under 30% HP with no reaction possible (KO’d, grappled, etc.): instant death or KO, no damage roll, no death save.' },
  ],
  SniperRifle: [
    { name: 'Atempause', stamina:2, pw:{mode:'same'}, effect:'This shot ignores the distance-based PW halving up to the Sniper Rifle\'s current maximum range (§6.4a/§7.7). With Hawk Eye III, it also ignores the halving on attacks beyond that maximum range.' },
    { name: 'Todesstoss', stamina:6, pw:{mode:'delta', amount:10}, effect:'Charge: no main action this round. Next round: shot at +10 PW and double weapon bonus.' },
    { name: 'Kettenschuss', stamina:4, pw:{mode:'override', stats:['focus','senses'], label:'Foc+Sen', amount:-4}, effect:'Shot passes through the first target into a second directly behind (-4 PW on the second).' },
    { name: 'Geisterschuetze', stamina:4, pw:{mode:'same'}, effect:"Position never revealed by this shot — no muzzle flash, no report. Works without a Suppressor too." },
    { name: 'Schwachstellen-Analyse', stamina:3, pw:{mode:'override', stats:['focus','senses'], label:'Foc+Sen'}, effect:"No shot. Analysis: next attack vs this target ignores its SP entirely." },
    { name: 'Sturmwindschuss', stamina:3, pw:{mode:'same'}, effect:'Ignores wind, smoke, darkness, and all visibility penalties entirely.' },
  ],
  Shotgun: [
    { name: 'Schrotsturm', stamina:3, pw:{mode:'same'}, effect:'All targets within 4m in front take full shot damage, each hit separately.' },
    { name: 'Breacher', stamina:2, pw:{mode:'same'}, effect:"Shot ignores cover HP entirely — even Thick Steel." },
    { name: 'Kniescheibe', stamina:3, pw:{mode:'same'}, effect:'Aimed Shot to the legs with no Aimed-Shot malus. Hit: Speed halved for 3 rounds.' },
    { name: 'Point-Blank Execution', stamina:4, pw:{mode:'same'}, effect:'Only vs a target at 0-2m: damage x2, ignores half SP.' },
    { name: 'Slug-Upgrade', stamina:2, pw:{mode:'same'}, effect:'Switches to a single slug projectile instead of shot: hits only one target, using its own effective/max range of 25m/75m (§6.4a) instead of the shotgun\'s normal 12m/30m. Normal distance rules apply within those values.' },
  ],
  HeavyWeapons: [
    { name: 'Flaechenbombardement', stamina:7, pw:{mode:'override', stats:['focus','strength'], label:'Foc+Str'}, effect:'Explosion area doubled to 20m x 20m. Damage unchanged.' },
    { name: 'Direktfeuer', stamina:4, pw:{mode:'override', stats:['focus','strength'], label:'Foc+Str'}, effect:"Grenade/rocket ignores cover HP entirely. Blast fully hits targets behind it." },
    { name: 'Schnellfeuer-Granate', stamina:3, pw:{mode:'override', stats:['focus','strength'], label:'Foc+Str'}, effect:'Fire the grenade launcher as part of a move, with no movement malus.' },
    { name: 'Geleitzug-Rakete', stamina:5, pw:{mode:'override', stats:['focus','strength'], label:'Foc+Str'}, effect:'Rocket tracks a moving target. Target reaction-rolls DV 20 or is automatically hit.' },
  ],
} as const;

export const HACK_CATALOG = {
  Combat: [
    {name:'Short Circuit', ip:5, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Electrical direct damage: roll result − half target Firewall. Armor ignored. Combo: doubled damage if target has Cyberware Malfunction active.'},
    {name:'Overheat', ip:5, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Burn: 4 dmg/round for 3 rounds, armor ignored. Combo: ignites Contagion on an infected target for an explosion.', autoStatus:{type:'burn', name:'Burn (Overheat)', rounds:3, stacks:2}},
    {name:'Contagion', ip:8, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Poison virus: 3 dmg/round for 4 rounds, spreads to up to 2 targets within 5m. Combo with Overheat/Burn → explosion (3m area).', autoStatus:{type:'poison', name:'Poison (Contagion)', rounds:4}},
    {name:'Synapse Burnout', ip:11, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Massive direct brain damage: 2× roll result − Firewall. No armor deduction. Crit Success: target instantly taken out.'},
    {name:'Cyberware Overload', ip:9, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Overloads target's implants: damage = roll result + 3 per cyberware item (GM estimate: lightly cybered 0-2, heavily cybered 4-6). Armor ignored. Only vs. cybered targets."},
  ],
  Control: [
    {name:'Cyberware Malfunction', ip:4, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Target −3 on cyberware actions. Stacks up to 3×. At 3 stacks: cyberware disabled for 2 rounds.', autoStatus:{type:'malfunction', name:'CW Malfunction', rounds:3, stacks:1, maxStacks:3}},
    {name:'Reboot Optics', ip:7, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Target blind for 1 round: no ranged attacks, −6 PW melee, no reaction roll.', autoStatus:{type:'blind', name:'Blind (Reboot Optics)', rounds:1}},
    {name:'Cripple Movement', ip:5, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Target loses secondary action/movement for 2 rounds.', autoStatus:{type:'stagger', name:'Stagger (Cripple Movement)', rounds:2}},
    {name:'Weapon Glitch', ip:7, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Target's next attack action automatically fails.", autoStatus:{type:'custom', name:'Weapon Glitch — next attack fails', rounds:1}},
    {name:'Sonic Shock', ip:4, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Target can't communicate for 1 round. Stealth rolls against target automatically succeed.", autoStatus:{type:'custom', name:"Sonic Shock — can't communicate", rounds:1}},
    {name:'Cyberpsychosis', ip:16, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Target attacks an ally for 2 rounds. Does not work on non-cybered targets.', autoStatus:{type:'custom', name:'Cyberpsychosis — attacks an ally', rounds:2}},
    {name:'Suicide', ip:14, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:"Turns target's own weapon against them: immediate full-weapon attack against self (no reaction roll). Only vs. cybered targets. Doesn't work on bosses with a Military deck."},
    {name:'Whistle', ip:4, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Lures a single target, which moves up to its Speed toward the netrunner's ping — isolates it from the group. Ideal for stealth takedowns."},
  ],
  Utility: [
    {name:'Ping', ip:2, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'All enemies/devices on the network visible for 3 rounds, even through walls.', netReveal:{rounds:3}},
    {name:'Memory Wipe', ip:8, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Target leaves combat mode and forgets the netrunner. In combat: target loses its initiative slot this round.'},
    {name:'Bait', ip:5, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Target is lured to a position — leaves cover and moves there.'},
    {name:'System Collapse', ip:11, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Target instantly unconscious (KO, not dead). Only works on targets below 30% Health.'},
    {name:'Breach', ip:4, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Opens doors, disables cameras, shuts down turrets.'},
    {name:'Detonate Grenade', ip:8, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:"Detonates target's grenade. Only if target carries grenades."},
    {name:'Request Backup', ip:10, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Hacks comms: 1d3 additional enemies are lured to a false position.'},
    {name:'System Reset', ip:18, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Full neural reset: target instantly unconscious (KO, not dead), regardless of HP. Needs 2 rounds of uninterrupted connection (announce round 1, effect round 2). Target must not leave range in round 1.'},
    {name:'Reflex-Membran', ip:7, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Self-buff: for the next 2 rounds the netrunner gets a reaction roll against the first attack each round at no action cost (even from an offensive stance). Survival aid for the exposed runner.'},
  ],
  Environment: [
    {name:'Blackout', ip:10, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Power outage in a sector (up to 30m radius), 3 rounds. Cameras/turrets disabled, electronic doors sealed or opened (GM choice). Non-thermal-optic combatants: −4 PW ranged. Combo: +4 PW Stealth in the blackout area.'},
    {name:'Hostile Architecture', ip:5, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Activates environment elements against a target: sprinklers (Cyberware Malfunction 1 stack immediately), vent covers (Stagger, target loses secondary action), barrier/roll-gate (blocks escape route). GM confirms availability per environment.'},
    {name:'Vehicle Override', ip:11, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Takes over a networked vehicle in range (up to 50m), 3 rounds. Control: accelerate, steer, doors. As a weapon: Ramming (Strength 12, ignores SP). Against an active driver: Int+Focus vs. Drive+Will of the driver.'},
    {name:'Broadcast Jam', ip:8, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Blocks all radio comms within 30m for 3 rounds. Enemies can't call for reinforcements. Drones without line-of-sight to their operator are deactivated. Combo: enemy Request Backup is automatically redirected to a false position."},
    {name:'Turret Override', ip:12, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Takes over a networked turret for 3 rounds, fires at targets of choice (PW = netrunner's Int+Focus). Combo: with Blackout — the turret is the only light source, all non-thermal-optic enemies are visible."},
    {name:'Emergency Protocol', ip:13, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:"Triggers the building's emergency system — choice of: LOCKDOWN (seals all electronic doors, 5 rounds) / FIRE SUPPRESSION (all sprinklers active: −4 PW sight, extinguishes fire effects, electro-hacks +1 Malfunction stack) / EVACUATION ALARM (civilians flee, ties up at least 1 round of enemy attention — GM decides tactical impact)."},
  ],
  Duel: [
    {name:'Neural Spike', ip:5, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:"Direct net attack: roll result − target's deck-quality value (Basic 5/Standard 10/Military 15/Blackmarket 20). Ignores Firewall and armor. Only vs. targets with an active cyberdeck."},
    {name:'Feedback Loop', ip:6, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:"Poisons target's deck: their next hack costs HP instead of IP (1:1). Persists until triggered or combat ends."},
    {name:'ICE Wall', ip:6, pwStats:['intelligence','focus'], pwLabel:'Int+Foc', effect:'Defensive: own Firewall +8 for 3 rounds. Every failed hack against it costs the attacker 2 IP. Costs a main action to maintain each round.'},
    {name:'Dead Drop', ip:7, pwStats:['intelligence','creativity'], pwLabel:'Int+Cre', effect:'Erases all running traces on self, hides position for 2 rounds — no Trace roll possible. Costs a main action.'},
  ],
} as const;

export const CONSUMABLE_CATALOG = {
  hp: {
    label: 'Pharma (HP)',
    basic: [
      {name:'MediStim "Patch"', dice:'1d10', min:5, costTier:'guenstig', note:'Standard injector. Available everywhere.'},
      {name:'TraumaTeam "Bounce"', dice:'1d20', min:10, costTier:'normal', note:'Blue nano-serum. The street standard.'},
      {name:'MaxDoc "Volldosis"', dice:'2d20', min:20, costTier:'teuer', note:'Heavy dose. Brief dizziness after (-1 PW next round).'},
    ],
    premium: [
      {name:'"Second Heart" Biochip', effect:'1x/24h: on falling to 0 HP, instantly rise to 50% Max HP. Consumed on use. (Implantable.)', costTier:'sehr teuer'},
      {name:'"Berserker" Combat-Stim', effect:'3d20 min. 30 HP + 1 round pain immunity (no wound malus). After: -2 all PW for 2 rounds (Crash).', costTier:'sehr teuer'},
      {name:'"Purge" Nano-Antidote', effect:'Instantly removes all Bleed/Poison/Burn/Malfunction effects. Also heals 1d10 HP.', costTier:'teuer'},
      {name:'"Ghost" Regen-Ampoule', effect:'Over the next 3 rounds, 1d10 HP each (Heal-over-Time). Does not stack with itself.', costTier:'teuer'},
      {name:'"Sandevistan" Emergency Reset', effect:'Netrunner/Solo with reflex cyberware only: instantly full Stamina + 1 extra secondary action this round. No HP.', costTier:'sehr teuer'},
    ],
  },
  ip: {
    label: 'Netrunner-Stims (IP)',
    basic: [
      {name:'Neuro-Booster "Spark"', dice:'1d10', min:5, costTier:'guenstig', note:'Cheap synapse kick. Slightly bitter aftertaste.'},
      {name:'Neuro-Booster "Surge"', dice:'1d20', min:10, costTier:'normal', note:"The standard runner's supply. Blue ampoule."},
      {name:'Neuro-Booster "Overflow"', dice:'2d20', min:20, costTier:'teuer', note:'Full charge. Brief nosebleed after (cosmetic).'},
    ],
    premium: [
      {name:'"Kerenzikov" Flow-Chip', effect:'Over the next 3 rounds, 1d10 IP each (IP-over-Time). Does not stack.', costTier:'teuer'},
      {name:'"ClearNet" Purge-Amp', effect:'Instantly removes Feedback Loop, trace markers, and ICE debuffs. Also 1d10 IP.', costTier:'teuer'},
      {name:'"Blackwall" Overcharge', effect:'Instantly full Max IP + next hack this round costs 0 IP. After: 1 round no hacking (Backlash).', costTier:'sehr teuer'},
    ],
  },
  stamina: {
    label: 'Kampf-Stims (Stamina)',
    basic: [
      {name:'Adrenal-Shot "Kick"', dice:'1d10', min:5, costTier:'guenstig', note:'Quick adrenaline burst. Heart races briefly.'},
      {name:'Adrenal-Shot "Rush"', dice:'1d20', min:10, costTier:'normal', note:'Military standard. Red auto-injector.'},
      {name:'Adrenal-Shot "Fury"', dice:'2d20', min:20, costTier:'teuer', note:'Full dose. After: -1 PW next round (shaking).'},
    ],
    premium: [
      {name:'"Berserk" Combat-Dose', effect:'Instantly full Max Stamina + 1 round: physical actions cost no Stamina. After: -2 PW for 2 rounds (Crash).', costTier:'sehr teuer'},
      {name:'"Endure" Slow-Release', effect:'Over the next 3 rounds, 1d10 Stamina each (over-Time). Does not stack.', costTier:'teuer'},
      {name:'"Second Wind" Ampoule', effect:'Instantly half Max Stamina + removes exhaustion/stagger effects. Secondary action.', costTier:'teuer'},
    ],
  },
} as const;

export const CYBERWARE_IMPACT = {
  'reinforced frame i': 1, 'reinforced frame ii': 1, 'reinforced frame iii': 2, 'reinforced frame iv': 2, 'reinforced frame v': 3,
  'neural link': 1, 'reflex booster': 2, 'kerenzikov': 2, 'sandevistan': 3, 'memory booster': 1, 'cyberdeck': 1, 'interface plugs': 1,
  'cybereye': 1, 'cybereye (basis)': 1, 'thermovision': 1, 'targeting system': 1, 'zoom optics': 1, 'kiroshi owl': 2,
  'cyberaudio suite': 1, 'level dampener': 0, 'radio scanner': 0, 'threat detector': 1,
  'cyberarm': 1, 'cyberleg': 1, 'gorilla arm': 1, 'mantis blades': 1, 'weapon mount': 1, 'grip strength': 0, 'hydraulic rams': 1, 'grip feet': 0,
  'subdermal armor': 1, 'stamina booster': 1, 'pain editor': 2, 'adrenaline booster': 1, 'toxin binders': 1,
  'titanium bones': 1, 'muscle & bone lace': 1, 'optical camo': 2, 'grafted muscles': 1,
  'techhair': 0, 'light tattoos': 0, 'chemskin': 0, 'nasal filters': 0,
  'full cyberarm': 2, 'full conversion': 5, 'full conversion (torso)': 5, 'cyberpsycho frame': 8,
} as const;

export const CYBERWARE_CATALOG = {
  'Neuralware': ['Neural Link', 'Reflex Booster', 'Kerenzikov', 'Sandevistan', 'Memory Booster', 'Pain Editor', 'Adrenaline Booster', 'Toxin Binders', 'Interface Plugs'],
  'Cyberoptics': ['Cybereye', 'Cybereye (Basis)', 'Thermovision', 'Targeting System', 'Zoom Optics', 'Kiroshi Owl'],
  'Cyberaudio': ['Cyberaudio Suite', 'Level Dampener', 'Radio Scanner', 'Threat Detector'],
  'Cyberlimbs': ['Cyberarm', 'Cyberleg', 'Gorilla Arm', 'Mantis Blades', 'Weapon Mount', 'Grip Strength', 'Hydraulic Rams', 'Grip Feet', 'Full Cyberarm'],
  'Frame & Skeleton': ['Reinforced Frame I', 'Reinforced Frame II', 'Reinforced Frame III', 'Reinforced Frame IV', 'Reinforced Frame V', 'Titanium Bones', 'Muscle & Bone Lace', 'Grafted Muscles', 'Subdermal Armor', 'Stamina Booster'],
  'Fashionware': ['Techhair', 'Light Tattoos', 'Chemskin', 'Nasal Filters', 'Optical Camo'],
  'Netrunning Gear': ['Cyberdeck', 'Basic ICE', 'Hardened ICE', 'Militech Firewall', 'Blackwall Fragment', 'Netrunner Helm', 'Faraday Helm'],
  'Full Conversion': ['Full Conversion', 'Full Conversion (Torso)', 'Cyberpsycho Frame'],
} as const;

