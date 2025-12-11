/**
 * @file メッセージリポジトリ
 */
export const MessageTemplates = {
    // --- 行動宣言 ---
    ATTACK_DECLARATION: '{attackerName}の{attackType}攻撃！　{trait}！',
    SUPPORT_DECLARATION: '{attackerName}の{actionType}行動！　{trait}！',
    ATTACK_MISSED: '※ERROR発生※　{attackerName}のターゲットが無効です',

    // --- 戦闘結果 ---
    ATTACK_EVADED: '{targetName}は攻撃を回避！',
    GUARDIAN_TRIGGERED: '{guardianName}のガード発動！　味方への攻撃を庇う！',
    GUARDIAN_DAMAGE: '{guardianName}の{partName}に{damage}ダメージ！',
    DEFENSE_SUCCESS: '{targetName}は{partName}で防御！　{partName}に{damage}ダメージ！',
    DAMAGE_APPLIED: '{targetName}の{partName}に{damage}ダメージ！',
    CRITICAL_HIT: 'クリティカル！　',
    PENETRATION_DAMAGE: '{partName}に貫通！　{partName}に{damage}ダメージ！',
    HEAL_SUCCESS: '{targetName}の{partName}を{healAmount}回復！',
    HEAL_FAILED: 'リペア失敗！　味方はダメージを受けていない！',

    // --- 状態異常・バフ・デバフ ---
    SUPPORT_SCAN_SUCCESS: '味方チームの命中精度が{scanBonus}上昇！　（{duration}ターン）',
    INTERRUPT_GLITCH_SUCCESS: 'システムエラー！　{targetName}は放熱へ移行！',
    INTERRUPT_GLITCH_FAILED: '妨害失敗！　放熱中機体には効果がない！',
    DEFEND_GUARD_SUCCESS: '味方への攻撃を{guardCount}回庇う！',
    GUARD_BROKEN: 'ガードパーツ破壊！　ガード解除！',
    GUARD_EXPIRED: '{actorName}のガード解除！',

    // --- 行動中断 ---
    CANCEL_PART_BROKEN: '行動予約パーツ破壊！　{actorName}は放熱へ移行！',
    CANCEL_TARGET_LOST: 'ターゲットロスト！　{actorName}は放熱へ移行！',
};

export const MessageKey = Object.keys(MessageTemplates).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});