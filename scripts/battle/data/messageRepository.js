/**
 * @file メッセージリポジトリ
 * ゲーム内で使用される全てのUIメッセージテンプレートを一元管理します。
 * これにより、文言の修正、一貫性の維持、将来的な多言語対応が容易になります。
 * メッセージ内のプレースホルダー（例: {attackerName}）は、MessageSystemによって動的に実際の値に置き換えられます。
 */
export const MessageTemplates = {
    // --- 行動宣言 ---
    ATTACK_DECLARATION: '{attackerName}の{attackType}攻撃！　{trait}！',
    SUPPORT_DECLARATION: '{attackerName}の{actionType}行動！　{trait}！',
    ATTACK_MISSED: '{attackerName}の攻撃は空を切った！', // ★このメッセージの出力は想定外動作です。

    // --- 戦闘結果 ---
    ATTACK_EVADED: '{targetName}は攻撃を回避！',
    GUARDIAN_TRIGGERED: '{guardianName}のガード発動！　味方への攻撃を庇う！',
    GUARDIAN_DAMAGE: '{guardianName}の{partName}に{damage}ダメージ！',
    DEFENSE_SUCCESS: '{targetName}は{partName}で防御！　{partName}に{damage}ダメージ！',
    DAMAGE_APPLIED: '{targetName}の{partName}に{damage}ダメージ！',
    CRITICAL_HIT: 'クリティカル！ ', // ダメージメッセージの接頭辞として使用
    PENETRATION_DAMAGE: '{partName}に貫通！　{partName}に{damage}ダメージ！',
    HEAL_SUCCESS: '{targetName}の{partName}を{healAmount}回復！',
    HEAL_FAILED: '行動失敗！　誰もダメージを受けていない！',

    // --- 状態異常・バフ・デバフ ---
    SUPPORT_SCAN_SUCCESS: '味方チーム全体の命中精度が{scanBonus}上昇！　（{duration}ターン）',
    INTERRUPT_GLITCH_SUCCESS: '{targetName}は放熱へ移行！',
    INTERRUPT_GLITCH_FAILED: '妨害失敗！　放熱中機体には効果がない！',
    DEFEND_GUARD_SUCCESS: '味方への攻撃を{guardCount}回庇う！',
    GUARD_BROKEN: 'ガードパーツ破壊！　ガード解除！',

    // --- 行動中断 ---
    CANCEL_PART_BROKEN: '行動予約パーツ破壊！　{actorName}は放熱に移行！',
    CANCEL_TARGET_LOST: 'ターゲットロスト！　{actorName}は放熱に移行！',
    // 【削除】妨害による行動中断メッセージ
    // CANCEL_INTERRUPTED: '妨害成功！　{actorName}は放熱に移行！',
};

/**
 * メッセージテンプレートのキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 */
export const MessageKey = Object.keys(MessageTemplates).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});