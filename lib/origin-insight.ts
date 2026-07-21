// Shared shape + honest data-derived fallback for the dashboard's ማጠቃለያ
// (origin insight) card. Used by /api/ai/origin-insight (as the no-key/error
// fallback) and by the client card (as the network-failure fallback), so the
// card can never show text that contradicts the computed numbers.

export type OriginInsightStats = {
  regions: number;
  effLeader: { origin: string; kgPerM: number };
  volLeader: { origin: string; kg: number };
  sameLeader: boolean;
  runnerUp: { origin: string; kgPerM: number } | null;
  weakest: { origin: string; kgPerM: number };
  totalKg: number;
  leaderSharePct: number;
};

export type OriginInsightText = { paragraph: string; question: string };

export function computedInsight(s: OriginInsightStats): OriginInsightText {
  if (s.sameLeader) {
    const runner = s.runnerUp && s.runnerUp.origin !== s.effLeader.origin ? s.runnerUp : null;
    return {
      paragraph:
        `«${s.effLeader.origin}» በሁለቱም መለኪያ ቀዳሚ ነው — በአንድ ሜትር ${s.effLeader.kgPerM.toFixed(2)} ኪግ (efficiency) እና በድምሩ ${s.volLeader.kg.toFixed(0)} ኪግ (volume)። ` +
        `ከጠቅላላው ${s.totalKg.toFixed(0)} ኪግ ምርት ${s.leaderSharePct}% ይይዛል።` +
        (runner ? ` በሁለተኛ ደረጃ «${runner.origin}» በ${runner.kgPerM.toFixed(2)} ኪግ/ሜትር ይከተላል።` : ""),
      question:
        `ጥያቄ፦ የ«${s.weakest.origin}» ምርታማነት (${s.weakest.kgPerM.toFixed(2)} ኪግ/ሜትር) ለማሻሻል እቅድ እንይዝ ወይስ የ«${s.effLeader.origin}» ስፋት እንጨምር?`,
    };
  }
  return {
    paragraph:
      `«${s.effLeader.origin}» በአንድ ሜትር የሚሰጠው ምርት (efficiency) ቀዳሚ ነው — ${s.effLeader.kgPerM.toFixed(2)} ኪግ/ሜትር። ` +
      `«${s.volLeader.origin}» ግን በድምሩ የሚሰጠው የምርት መጠን (volume) ይበልጣል — ${s.volLeader.kg.toFixed(0)} ኪግ (${s.leaderSharePct}% የእርሻው ምርት)።`,
    question:
      `ጥያቄ፦ የ«${s.volLeader.origin}»ን ምርታማነት ማሻሻል ይፈልጋሉ ወይስ የ«${s.effLeader.origin}»ን የተከላ ስፋት መጨመር?`,
  };
}
